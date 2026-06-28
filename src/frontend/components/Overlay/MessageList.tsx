import { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { User, Bot } from 'lucide-react';
import { useVoiceStore } from '../../store/voiceStore';

const userCardStyle = {
  backgroundColor: 'rgba(37, 99, 235, 0.12)',
  border: '1px solid rgba(59, 130, 246, 0.28)',
};

const assistantCardStyle = {
  backgroundColor: 'rgba(15, 23, 42, 0.95)',
  border: '1px solid rgba(52, 211, 153, 0.24)',
  boxShadow: '0 16px 28px rgba(0, 0, 0, 0.18)',
};

export default function MessageList() {
  const { messages } = useVoiceStore();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: '#4b5563',
          fontSize: '13px',
          textAlign: 'center',
          padding: '24px',
        }}
      >
        Press <strong style={{ color: '#6b7280', margin: '0 4px' }}>hotkey</strong> to start recording
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {messages.map((message) => {
        const isAssistant = message.type === 'assistant';

        return (
          <div
            key={message.id}
            style={{
              display: 'flex',
              gap: '12px',
              padding: '14px',
              borderRadius: '12px',
              ...(isAssistant ? assistantCardStyle : userCardStyle),
            }}
          >
            <div
              style={{
                flexShrink: 0,
                width: '32px',
                height: '32px',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: isAssistant ? '#0f766e' : '#2563eb',
                boxShadow: isAssistant
                  ? '0 10px 24px rgba(15, 118, 110, 0.28)'
                  : '0 10px 24px rgba(37, 99, 235, 0.24)',
              }}
            >
              {isAssistant ? (
                <Bot style={{ width: '16px', height: '16px', color: 'white' }} />
              ) : (
                <User style={{ width: '16px', height: '16px', color: 'white' }} />
              )}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  marginBottom: '8px',
                }}
              >
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    color: isAssistant ? '#5eead4' : '#93c5fd',
                  }}
                >
                  {isAssistant ? 'Answer' : 'Transcript'}
                </span>
                <span style={{ fontSize: '11px', color: '#6b7280', flexShrink: 0 }}>
                  {new Date(message.timestamp).toLocaleTimeString()}
                </span>
              </div>

              {isAssistant ? (
                <div className="assistant-markdown">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      p: ({ children }) => <p>{children}</p>,
                      ol: ({ children }) => <ol>{children}</ol>,
                      ul: ({ children }) => <ul>{children}</ul>,
                      li: ({ children }) => <li>{children}</li>,
                      h1: ({ children }) => <h1>{children}</h1>,
                      h2: ({ children }) => <h2>{children}</h2>,
                      h3: ({ children }) => <h3>{children}</h3>,
                      blockquote: ({ children }) => <blockquote>{children}</blockquote>,
                      pre: ({ children }) => <pre>{children}</pre>,
                      code: ({ className, children, ...props }) => {
                        const isBlock = Boolean(className);
                        if (isBlock) {
                          return (
                            <code className={className} {...props}>
                              {children}
                            </code>
                          );
                        }

                        return (
                          <code className="inline-code" {...props}>
                            {children}
                          </code>
                        );
                      },
                      table: ({ children }) => (
                        <div className="table-wrap">
                          <table>{children}</table>
                        </div>
                      ),
                    }}
                  >
                    {message.text}
                  </ReactMarkdown>
                </div>
              ) : (
                <div
                  style={{
                    fontSize: '13px',
                    color: '#dbeafe',
                    lineHeight: '1.6',
                    whiteSpace: 'pre-wrap',
                    wordWrap: 'break-word',
                    overflowWrap: 'break-word',
                  }}
                >
                  {message.text}
                </div>
              )}
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
