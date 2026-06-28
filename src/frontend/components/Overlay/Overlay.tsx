import { GripHorizontal, Settings } from 'lucide-react';
import { useVoiceStore } from '../../store/voiceStore';
import MessageList from './MessageList';
import StateIndicator from './StateIndicator';

export default function Overlay() {
  const { setShowSettings } = useVoiceStore();

  return (
    <div
      style={{
        width: '100%',
        height: '100vh',
        backgroundColor: '#111827',
        display: 'flex',
        flexDirection: 'column',
        color: 'white',
        fontFamily: 'sans-serif',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 16px',
          backgroundColor: '#1f2937',
          borderBottom: '1px solid #374151',
          flexShrink: 0,
          // @ts-ignore
          WebkitAppRegion: 'drag',
          userSelect: 'none',
          cursor: 'move',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <GripHorizontal className="w-4 h-4 text-gray-500" />
          <h1 style={{ fontSize: '14px', fontWeight: 'bold', color: 'white', margin: 0 }}>
            AI Interview Helper
          </h1>
        </div>

        <button
          onClick={() => setShowSettings(true)}
          style={{
            padding: '8px',
            backgroundColor: 'transparent',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            color: 'white',
            // @ts-ignore
            WebkitAppRegion: 'no-drag',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#374151')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          title="Settings (Ctrl+Shift+S)"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      <div style={{ flexShrink: 0, padding: '12px 24px 0' }}>
        <StateIndicator />
      </div>

      <div
        className="custom-scrollbar"
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: '8px 24px',
          // @ts-ignore
          WebkitAppRegion: 'no-drag',
        }}
      >
        <MessageList />
      </div>

      <div style={{ flexShrink: 0, padding: '0 24px 16px' }}>
        <HotkeyHint />
      </div>
    </div>
  );
}

function HotkeyHint() {
  const { config } = useVoiceStore();

  return (
    <div style={{ borderTop: '1px solid #374151', paddingTop: '12px', textAlign: 'center' }}>
      <p style={{ fontSize: '11px', color: '#34d399', marginBottom: '6px' }}>
        Audio: {config.transcriptionLanguage?.toUpperCase()} -&gt; {config.responseLanguage?.toUpperCase()}
      </p>
      <p style={{ fontSize: '11px', color: '#6b7280', margin: '0 0 4px 0' }}>
        <kbd>{config.hotkey}</kbd> interviewer
        {' | '}
        <kbd>{config.microphoneHotkey || 'Ctrl+Shift+Alt+Q'}</kbd> my mic
      </p>
      <p style={{ fontSize: '11px', color: '#6b7280', margin: 0 }}>
        <kbd>{config.codingHotkey || 'Ctrl+Shift+`'}</kbd> screenshot + interviewer
        {' | '}
        <kbd>{config.microphoneCodingHotkey || 'Ctrl+Shift+Alt+`'}</kbd> screenshot + my mic
        {' | '}
        <kbd>Ctrl+Shift+S</kbd> settings
        {' | '}
        <kbd>Ctrl+Shift+H</kbd> hide
      </p>
    </div>
  );
}
