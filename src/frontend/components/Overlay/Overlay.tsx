import { useVoiceStore } from '../../store/voiceStore';
import StateIndicator from './StateIndicator';
import MessageList from './MessageList';

export default function Overlay() {
  return (
    <div className="w-full h-full bg-gray-900 p-6 flex flex-col text-white font-sans">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold text-white">
          🎤 AI Assistant
        </h1>
        <span className="text-xs text-gray-500">
          Ctrl+Shift+Space to talk
        </span>
      </div>
 
      <div className="flex-1 flex flex-col">
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
  
  return (
    <div className="mt-4 pt-4 border-t border-gray-700 text-center">
      <p className="text-xs text-gray-400">
        <kbd className="px-2 py-1 bg-gray-700 rounded text-gray-300 font-mono text-xs">
          {config.hotkey}
        </kbd>
        {' '}activate
        {' • '}
        <kbd className="px-2 py-1 bg-gray-700 rounded text-gray-300 font-mono text-xs">
          Ctrl+Shift+S
        </kbd>
        {' '}settings
        {' • '}
        <kbd className="px-2 py-1 bg-gray-700 rounded text-gray-300 font-mono text-xs">
          Ctrl+Shift+H
        </kbd>
        {' '}hide
      </p>
    </div>
  );
}