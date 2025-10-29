import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import { config } from 'dotenv';
import IORedis from 'ioredis';
// ioredis types sometimes export the class as default with no construct signatures under certain TS settings.
// Use `any` to instantiate safely in NodeNext builds.
const RedisCtor: any = IORedis as any;
import { z } from 'zod';
import { AgentQuestions, ClientToServerEvents, FollowUpPayload, MAX_ITEMS, MAX_TOTAL_CHARS, ServerToClientEvents } from '@mini/shared';
import OpenAI from 'openai';

config();

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const redis = new RedisCtor(redisUrl);
const redisPub = new RedisCtor(redisUrl);
const redisSub = new RedisCtor(redisUrl);

const STREAM_FOLLOWUPS = 'followups:stream';
const STREAM_QUESTIONS = 'questions:stream';
const CHANNEL_LIVE = 'questions:live';

const app = Fastify({ logger: true });
app.register(websocket);

app.get('/health', async () => ({ ok: true }));

type WSClient = {
  send: (event: keyof ServerToClientEvents, data: AgentQuestions) => void;
  lastStreamId?: string;
};

const clients = new Set<WSClient>();

const followupSchema = z.object({
  items: z.array(z.string().trim()).max(MAX_ITEMS),
  createdAt: z.number(),
});

function normalizeItems(raw: string[]): string[] {
  const list = raw
    .flatMap((s) => s.split(','))
    .map((s) => s.trim())
    .filter(Boolean);
  const totalChars = list.join(', ').length;
  if (totalChars > MAX_TOTAL_CHARS) {
    throw new Error('Payload too large');
  }
  return list.slice(0, MAX_ITEMS);
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function generateQuestions(items: string[]): Promise<string> {
  const system = 'You are a polite assistant that turns a list of items into a single sentence of 2–4 concise, polite clarifying questions. Keep it short and friendly.';
  const user = `Items: ${items.join(', ')}\nRespond as one question sentence.`;
  const resp = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    max_tokens: 120,
    temperature: 0.2,
  });
  return resp.choices[0]?.message?.content?.trim() || `Could you clarify: ${items.join(', ')}?`;
}

async function handleFollowupCreate(payload: FollowUpPayload) {
  // simple global rate limit: max 20 per minute
  const rl = await redis.incr('rate:global:minute');
  if (rl === 1) {
    await redis.expire('rate:global:minute', 60);
  }
  if (rl > 20) return;
  const items = normalizeItems(payload.items);
  // Dedup by hash over 15s
  const key = `dedup:${items.join('|')}`;
  const set = await redis.set(key, '1', 'EX', 15, 'NX');
  if (!set) return; // duplicate

  const followupId = (await redis.xadd(
    STREAM_FOLLOWUPS,
    '*',
    'items', JSON.stringify(items),
    'ts', String(payload.createdAt)
  )) as unknown as string;
  const text = await generateQuestions(items);
  const createdAt = Date.now();
  const streamId = (await redis.xadd(
    STREAM_QUESTIONS,
    '*',
    'text', text,
    'ts', String(createdAt),
    'followupId', followupId
  )) as unknown as string;

  const message: AgentQuestions = { text, createdAt, streamId };
  await redisPub.publish(CHANNEL_LIVE, JSON.stringify(message));
  // Also push to connected clients immediately
  for (const c of clients) {
    c.send('agent:questions', message);
    c.lastStreamId = streamId;
  }
}

app.register(async (instance) => {
  instance.get('/ws', { websocket: true }, (connection) => {
    const client: WSClient = {
      send: (event, data) => {
        connection.socket.send(JSON.stringify({ event, data }));
      },
    };
    clients.add(client);

    connection.socket.on('message', async (raw: unknown) => {
      try {
        const msg = JSON.parse(String(raw as any));
        if (msg?.event === 'followup:create') {
          const parsed = followupSchema.safeParse(msg.data);
          if (!parsed.success) return;
          await handleFollowupCreate(parsed.data as FollowUpPayload);
        } else if (msg?.event === 'replay:since' && typeof msg?.data?.id === 'string') {
          const sinceId = msg.data.id as string;
          const records = await redis.xread('COUNT', 50, 'STREAMS', STREAM_QUESTIONS, sinceId);
          const entries = records?.[0]?.[1] || [];
          for (const [id, fields] of entries) {
            const text = String(fields[fields.indexOf('text') + 1] ?? '');
            const ts = Number(fields[fields.indexOf('ts') + 1] ?? Date.now());
            const data: AgentQuestions = { text, createdAt: ts, streamId: id };
            client.send('agent:questions', data);
            client.lastStreamId = id;
          }
        }
      } catch {}
    });

    connection.socket.on('close', () => {
      clients.delete(client);
    });
  });
});

// Subscribe to live channel for redundancy (not strictly required since we push directly)
redisSub.subscribe(CHANNEL_LIVE, () => {});
redisSub.on('message', (_channel: string, message: string) => {
  try {
    const data = JSON.parse(message) as AgentQuestions;
    for (const c of clients) c.send('agent:questions', data);
  } catch {}
});

const port = Number(process.env.PORT || 3000);
app.listen({ port, host: '0.0.0.0' }).then(() => {
  app.log.info(`Server listening on http://localhost:${port}`);
});


