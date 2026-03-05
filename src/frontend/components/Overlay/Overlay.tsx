import { useVoiceStore } from '../../store/voiceStore';
import StateIndicator from './StateIndicator';
import MessageList from './MessageList';
import { GripHorizontal, Settings } from 'lucide-react';

export default function Overlay() {
  const { setShowSettings, config } = useVoiceStore();

  return (
    <div className="w-full h-full bg-gray-900 flex flex-col text-white font-sans">

      <div 
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 16px',
          backgroundColor: '#1f2937',
          borderBottom: '1px solid #374151',
          // @ts-ignore
          WebkitAppRegion: 'drag',
          userSelect: 'none',
          cursor: 'move'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <GripHorizontal className="w-4 h-4 text-gray-500" />
          <h1 className="text-sm font-bold text-white">
             AI Interview Helper
          </h1>
        </div>
        
        <button
          onClick={() => setShowSettings(true)}
          className="p-2 hover:bg-gray-700 text-gray-100 rounded-lg transition-colors"
          style={{
            // @ts-ignore
            WebkitAppRegion: 'no-drag',
            cursor: 'pointer',
            backgroundColor: 'transparent',
            color: 'white',
            border: 'none',
          }}
          title="Settings (Ctrl+Shift+S)"
        >
          <Settings className="w-4 h-4  hover:text-white" fill='transparent' />
        </button>
      </div>
 
      <div className="flex-1 p-6 flex flex-col overflow-hidden">
        <StateIndicator />
        <div className="flex-1 overflow-hidden">
          <MessageList />
        </div>
        <HotkeyHint />
      </div>
    </div>
  );
}

function HotkeyHint() {
  const { config } = useVoiceStore();

  const hints = {
    en: {
      languages: `Listening: ${config.transcriptionLanguage.toUpperCase()} → Responding: ${config.responseLanguage.toUpperCase()}`,
      capture: 'start/stop capture',
      settings: 'settings',
      hide: 'hide'
    },
    ru: {
      languages: `Слушаю: ${config.transcriptionLanguage.toUpperCase()} → Отвечаю: ${config.responseLanguage.toUpperCase()}`,
      capture: 'начать/остановить захват',
      settings: 'настройки',
      hide: 'скрыть'
    },
    uk: {
      languages: `Слухаю: ${config.transcriptionLanguage.toUpperCase()} → Відповідаю: ${config.responseLanguage.toUpperCase()}`,
      capture: 'почати/зупинити захоплення',
      settings: 'налаштування',
      hide: 'сховати'
    }
  };

  const currentHints = hints[config.responseLanguage as keyof typeof hints] || hints.en;

  return (
    <div className="mt-4 pt-4 border-t border-gray-700 text-center">
      <p className="text-xs text-green-400 mb-2">
        📢 {currentHints.languages}
      </p>
      <p className="text-xs text-gray-400">
        <kbd className="px-2 py-1 bg-gray-700 rounded text-gray-300 font-mono text-xs">
          {config.hotkey}
        </kbd>
        {' '}{currentHints.capture}
        {' • '}
        <kbd className="px-2 py-1 bg-gray-700 rounded text-gray-300 font-mono text-xs">
          Ctrl+Shift+S
        </kbd>
        {' '}{currentHints.settings}
        {' • '}
        <kbd className="px-2 py-1 bg-gray-700 rounded text-gray-300 font-mono text-xs">
          Ctrl+Shift+H
        </kbd>
        {' '}{currentHints.hide}
      </p>
    </div>
  );
}