import { useState } from 'react';
import { useVoiceStore } from '../../store/voiceStore';
import StateIndicator from './StateIndicator';
import MessageList from './MessageList';
import { SpeechRecognition } from '@/types/speech';

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  }
}

export default function Overlay() {
  const [micStatus, setMicStatus] = useState<string>('');

  const testMicrophone = async () => {
    setMicStatus('Testing...');
    
    try {
      console.log('🎤 Testing microphone access...');
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('✅ Microphone access granted');
      
      stream.getTracks().forEach(track => track.stop());
      
      setMicStatus('✅ Microphone OK!');
      
      const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;

      if (SpeechRecognition) {
        setMicStatus('✅ Mic OK, Speech API available');
      } else {
        setMicStatus('✅ Mic OK, but Speech API not found');
      }
      
    } catch (err) {
      console.error('❌ Microphone test failed:', err);
      setMicStatus(`❌ Error: ${err.message}`);
    }
  };

  return (
    <div style={{
      width: '100%',
      height: '100%',
      backgroundColor: '#1a1a2e',
      padding: '24px',
      display: 'flex',
      flexDirection: 'column',
      color: 'white',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '16px'
      }}>
        <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: 'white', margin: 0 }}>
          🎤 AI Assistant
        </h1>
        <button
          onClick={testMicrophone}
          style={{
            padding: '6px 12px',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '12px'
          }}
        >
          Test Mic
        </button>
      </div>

 
      {micStatus && (
        <div style={{
          padding: '8px 12px',
          backgroundColor: micStatus.includes('✅') ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
          borderRadius: '6px',
          marginBottom: '12px',
          fontSize: '12px'
        }}>
          {micStatus}
        </div>
      )}

 
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <StateIndicator />
        <div style={{ flex: 1, overflow: 'hidden' }}>
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
    <div style={{ 
      marginTop: '16px', 
      paddingTop: '16px', 
      borderTop: '1px solid #374151',
      textAlign: 'center'
    }}>
      <p style={{ fontSize: '12px', color: '#9ca3af' }}>
        <kbd style={kbdStyle}>{config.hotkey}</kbd> activate
        {' • '}
        <kbd style={kbdStyle}>Ctrl+Shift+S</kbd> settings
        {' • '}
        <kbd style={kbdStyle}>Ctrl+Shift+H</kbd> hide
      </p>
    </div>
  );
}

const kbdStyle: React.CSSProperties = {
  padding: '2px 8px',
  backgroundColor: '#374151',
  borderRadius: '4px',
  color: '#d1d5db',
  fontFamily: 'monospace',
  fontSize: '11px'
};