# Mini-Project — Redis + PUML Edition

Monorepo with two React frontends and a Fastify server using Redis Streams/PubSub, WebSockets, and OpenAI.

## Structure
- `apps/reviewer` — Reviewer UI (send comma-separated items over WS)
- `apps/participant` — Participant UI (receive, display, speak questions; replay on reconnect)
- `services/server` — Fastify + WS + Redis + OpenAI
- `packages/shared` — Shared TypeScript types and limits
- `docs/architecture.puml` — PlantUML diagram

## Prereqs
- Node 20+
- pnpm (recommended): `npm i -g pnpm`
- Redis (local or via docker-compose)

## Setup
```
pnpm i
```

Create `services/server/.env` based on `services/server/env.example`.

## Run (local)
In separate terminals:
- Server: `pnpm --filter @mini/server dev` (http://localhost:3000)
- Reviewer: `pnpm --filter @mini/reviewer dev` (http://localhost:5173)
- Participant: `pnpm --filter @mini/participant dev` (http://localhost:5174)

Or docker: `docker-compose up -d`

## OpenAI
- Model: `gpt-4o-mini`
- System prompt: polite, concise clarifying question from item list
- Max tokens ~120, temperature 0.2

## Acceptance Test
1. Start Redis, server, and both UIs
2. Open Participant → shows ready
3. In Reviewer, enter: `latency, retry logic, error states`
4. Server calls OpenAI and broadcasts
5. Participant displays and speaks the generated question
6. Send second list quickly → ordered, no TTS overlap
7. Close/reopen Participant → messages replay from last stream id

See `docs/architecture.puml` for flow.