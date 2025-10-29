import React, { useEffect, useRef, useState } from 'react';
import type { AgentQuestions, ServerToClientEvents } from '@mini/shared/src/index';

function speakQueue(text: string, queue: SpeechSynthesisUtterance[], speakingRef: React.MutableRefObject<boolean>) {
  const utter = new SpeechSynthesisUtterance(text);
  utter.onend = () => {
    queue.shift();
    speakingRef.current = false;
    if (queue.length > 0) {
      speakQueue(queue[0].text, queue, speakingRef);
    }
  };
  speakingRef.current = true;
  window.speechSynthesis.speak(utter);
}

export const App: React.FC = () => {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [ready, setReady] = useState(false);
  const [messages, setMessages] = useState<AgentQuestions[]>([]);
  const [lastId, setLastId] = useState<string | undefined>(undefined);
  const ttsQueue = useRef<SpeechSynthesisUtterance[]>([]);
  const speakingRef = useRef(false);

  useEffect(() => {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.host;
    const socket = new WebSocket(`${wsProtocol}//${wsHost}/ws`);
    socket.onopen = () => {
      setReady(true);
      if (lastId) {
        socket.send(JSON.stringify({ event: 'replay:since', data: { id: lastId } }));
      }
    };
    socket.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data) as { event: keyof ServerToClientEvents; data: AgentQuestions };
        if (msg.event === 'agent:questions') {
          setMessages((prev) => [...prev, msg.data]);
          setLastId(msg.data.streamId);
          const utter = new SpeechSynthesisUtterance(msg.data.text);
          ttsQueue.current.push(utter);
          if (!speakingRef.current) {
            speakQueue(ttsQueue.current[0].text, ttsQueue.current, speakingRef);
          }
        }
      } catch {}
    };
    socket.onclose = () => setReady(false);
    setWs(socket);
    return () => socket.close();
  }, []);

  return (
    <div style={{ fontFamily: 'sans-serif', padding: 24 }}>
      <h1>Participant</h1>
      <p>{ready ? 'ready' : 'connecting...'}</p>
      <div>
        {messages.map((m, i) => (
          <div key={m.streamId ?? i} style={{ marginBottom: 8 }}>
            {m.text}
          </div>
        ))}
      </div>
    </div>
  );
};



