import { useEffect, useRef } from 'react';
import { useVoiceStore } from '../../store/voiceStore';
import { User, Bot } from 'lucide-react';

function renderMarkdown(text: string) {
  let formatted = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
  formatted = formatted.replace(/\n/g, '<br>');
  return formatted;
}

export default function MessageList() {
  const { messages } = useVoiceStore();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        color: '#4b5563',
        fontSize: '13px',
        textAlign: 'center',
        padding: '24px',
      }}>
        Press <strong style={{ color: '#6b7280', margin: '0 4px' }}>hotkey</strong> to start recording
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {messages.map((message) => (
        <div
          key={message.id}
          style={{
            display: 'flex',
            gap: '12px',
            padding: '12px',
            borderRadius: '12px',
            backgroundColor: message.type === 'user'
              ? 'rgba(37, 99, 235, 0.15)'
              : 'rgba(22, 163, 74, 0.15)',
            border: `1px solid ${message.type === 'user'
              ? 'rgba(59, 130, 246, 0.3)'
              : 'rgba(34, 197, 94, 0.3)'}`,
          }}
        >
          <div style={{
            flexShrink: 0,
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: message.type === 'user' ? '#2563eb' : '#16a34a',
          }}>
            {message.type === 'user'
              ? <User style={{ width: '16px', height: '16px', color: 'white' }} />
              : <Bot style={{ width: '16px', height: '16px', color: 'white' }} />
            }
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: '13px',
                color: 'white',
                lineHeight: '1.6',
                wordWrap: 'break-word',
                overflowWrap: 'break-word',
              }}
              dangerouslySetInnerHTML={{ __html: renderMarkdown(message.text) }}
            />
            <span style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px', display: 'block' }}>
              {new Date(message.timestamp).toLocaleTimeString()}
            </span>
          </div>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}