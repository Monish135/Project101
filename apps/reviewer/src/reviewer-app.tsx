import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { ClientToServerEvents, FollowUpPayload } from '@mini/shared/src/index';

function normalize(input: string): string[] {
  return input
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export const App: React.FC = () => {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'ack'>('disconnected');
  const [text, setText] = useState('');
  const ackTimeout = useRef<number | null>(null);

  useEffect(() => {
    setStatus('connecting');
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.host;
    const socket = new WebSocket(`${wsProtocol}//${wsHost}/ws`);
    socket.onopen = () => setStatus('connected');
    socket.onclose = () => setStatus('disconnected');
    setWs(socket);
    return () => socket.close();
  }, []);

  const send = useMemo(() => {
    return (event: keyof ClientToServerEvents, data: unknown) => {
      if (!ws || ws.readyState !== ws.OPEN) return;
      ws.send(JSON.stringify({ event, data }));
      if (ackTimeout.current) window.clearTimeout(ackTimeout.current);
      ackTimeout.current = window.setTimeout(() => setStatus('ack'), 500);
    };
  }, [ws]);

  const onSubmit = () => {
    const items = normalize(text);
    if (items.length === 0) return;
    const payload: FollowUpPayload = { items, createdAt: Date.now() };
    send('followup:create', payload);
  };

  return (
    <div style={{ fontFamily: 'sans-serif', padding: 24 }}>
      <h1>Reviewer</h1>
      <p>Status: {status}</p>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Enter comma-separated items"
          style={{ flex: 1 }}
        />
        <button onClick={onSubmit}>Send</button>
      </div>
      <p style={{ marginTop: 12 }}>Mic optional: use text input for now.</p>
    </div>
  );
};



