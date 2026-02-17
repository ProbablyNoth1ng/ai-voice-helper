import React from 'react';
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
  const recentMessages = messages.slice(-3);

  if (recentMessages.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3 max-h-64 overflow-y-auto custom-scrollbar">
      {recentMessages.map((message) => (
        <div
          key={message.id}
          className={`flex gap-3 p-3 rounded-xl ${
            message.type === 'user'
              ? 'bg-blue-600 bg-opacity-20 border border-blue-500 border-opacity-30'
              : 'bg-green-600 bg-opacity-20 border border-green-500 border-opacity-30'
          }`}
        >
          <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
            message.type === 'user' ? 'bg-blue-600' : 'bg-green-600'
          }`}>
            {message.type === 'user' ? (
              <User className="w-4 h-4 text-white" />
            ) : (
              <Bot className="w-4 h-4 text-white" />
            )}
          </div>
          <div className="flex-1">
            <div 
              className="text-sm text-white leading-relaxed"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(message.text) }}
              style={{
                wordWrap: 'break-word',
                overflowWrap: 'break-word'
              }}
            />
            <span className="text-xs text-gray-400 mt-1 block">
              {new Date(message.timestamp).toLocaleTimeString()}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}