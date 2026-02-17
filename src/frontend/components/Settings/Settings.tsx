import { useState, useEffect } from 'react';
import { X, Save, Eye, Pin, Languages, MessageSquare, CheckCircle } from 'lucide-react';
import { useVoiceStore } from '../../store/voiceStore';
import { io } from 'socket.io-client';

interface ElectronAPI {
  setOpacity: (value: number) => void;
  setAlwaysOnTop: (value: boolean) => void;
  hideWindow: () => void;
  showWindow: () => void;
}

interface WindowWithElectron extends Window {
  electronAPI?: ElectronAPI;
}

declare const window: WindowWithElectron;

export default function SettingsPanel() {
  const { config, updateConfig, setShowSettings } = useVoiceStore();
  const [localConfig, setLocalConfig] = useState(config);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setLocalConfig(config);
  }, [config]);

  useEffect(() => {
    console.log('⚙️ SettingsPanel mounted');
    return () => console.log('⚙️ SettingsPanel unmounted');
  }, []);

  const handleOpacityChange = (value: number) => {
    setLocalConfig({ ...localConfig, opacity: value });
     
    if (window.electronAPI) {
      window.electronAPI.setOpacity(value);
    }
  };
 
  const handleAlwaysOnTopChange = () => {
    const newValue = !localConfig.alwaysOnTop;
    setLocalConfig({ ...localConfig, alwaysOnTop: newValue });
     
    if (window.electronAPI) {
      window.electronAPI.setAlwaysOnTop(newValue);
    }
  };

  const handleTranscriptionLanguageChange = (language: string) => {
    console.log('🌍 Transcription language changed to:', language);
    setLocalConfig({ ...localConfig, transcriptionLanguage: language });
  };

  const handleResponseLanguageChange = (language: string) => {
    console.log('🌍 Response language changed to:', language);
    setLocalConfig({ ...localConfig, responseLanguage: language });
  };

  const handleSave = () => {
    console.log('💾 Saving config:', localConfig);
    updateConfig(localConfig);
    
    const socket = io('http://localhost:3001');
    socket.emit('update-config', localConfig);
    
    socket.on('config-updated', () => {
      console.log('✅ Config updated on backend');
      socket.close();
    });
  
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleClose = () => {
    console.log('⚙️ Closing settings');
    setShowSettings(false);
  };

  const languageOptions = [
    { code: 'en', label: '🇬🇧 English', name: 'English' },
    { code: 'ru', label: '🇷🇺 Русский', name: 'Russian' },
    { code: 'uk', label: '🇺🇦 Українська', name: 'Ukrainian' }
  ];

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'flex-end',
        padding: '32px',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        // @ts-ignore
        WebkitAppRegion: 'no-drag'
      }}
    > 
      <div 
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          // @ts-ignore
          WebkitAppRegion: 'no-drag'
        }}
        onClick={handleClose}
      />
       
      <div 
        style={{
          position: 'relative',
          backgroundColor: '#111827',
          borderRadius: '16px',
          border: '1px solid #374151',
          width: '384px',
          maxHeight: '80vh',
          overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          // @ts-ignore 
          WebkitAppRegion: 'no-drag'
        }}
      > 
        <div 
          style={{
            backgroundColor: '#1f2937',
            borderBottom: '1px solid #374151',
            padding: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            // @ts-ignore
            WebkitAppRegion: 'no-drag'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: 'white', margin: 0 }}>
              Settings
            </h2>
          </div>
          <button
            onClick={handleClose}
            style={{
              padding: '8px',
              backgroundColor: 'transparent',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              // @ts-ignore
              WebkitAppRegion: 'no-drag'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#374151'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <X style={{ width: '20px', height: '20px', color: '#9ca3af' }} />
          </button>
        </div>

        <div 
          className="custom-scrollbar"
          style={{ 
            padding: '24px', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '24px',
            maxHeight: 'calc(80vh - 72px)',
            overflowY: 'auto',
            // @ts-ignore
            WebkitAppRegion: 'no-drag'
          }}
        >
          
          <div style={{
            backgroundColor: '#1e3a8a',
            border: '1px solid #3b82f6',
            borderRadius: '8px',
            padding: '12px',
            display: 'flex',
            gap: '8px'
          }}>
            <CheckCircle style={{ width: '20px', height: '20px', color: '#60a5fa', flexShrink: 0 }} />
            <div style={{ fontSize: '13px', color: '#bfdbfe', lineHeight: '1.5' }}>
              <strong>Language Settings:</strong> Audio will be transcribed in <strong>{localConfig.transcriptionLanguage.toUpperCase()}</strong>, and AI will respond in <strong>{localConfig.responseLanguage.toUpperCase()}</strong>.
            </div>
          </div>

          <div>
            <label 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px', 
                fontSize: '14px', 
                fontWeight: '500', 
                color: '#d1d5db',
                marginBottom: '12px'
              }}
            >
              <Languages style={{ width: '16px', height: '16px' }} />
              Transcription Language (What language to listen)
            </label>
            <select
              value={localConfig.transcriptionLanguage}
              onChange={(e) => handleTranscriptionLanguageChange(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #374151',
                backgroundColor: '#1f2937',
                color: '#d1d5db',
                fontSize: '14px',
                cursor: 'pointer',
                outline: 'none'
              }}
            >
              {languageOptions.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.label}
                </option>
              ))}
            </select>
            <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px', margin: '8px 0 0 0' }}>
              {localConfig.transcriptionLanguage === 'en' && '🎤 Audio will be transcribed from English'}
              {localConfig.transcriptionLanguage === 'ru' && '🎤 Аудио будет распознано с русского'}
              {localConfig.transcriptionLanguage === 'uk' && '🎤 Аудіо буде розпізнано з українскої'}
            </p>
          </div>

          <div>
            <label 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px', 
                fontSize: '14px', 
                fontWeight: '500', 
                color: '#d1d5db',
                marginBottom: '12px'
              }}
            >
              <MessageSquare style={{ width: '16px', height: '16px' }} />
              Response Language (AI reply language)
            </label>
            <select
              value={localConfig.responseLanguage}
              onChange={(e) => handleResponseLanguageChange(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #374151',
                backgroundColor: '#1f2937',
                color: '#d1d5db',
                fontSize: '14px',
                cursor: 'pointer',
                outline: 'none'
              }}
            >
              {languageOptions.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.label}
                </option>
              ))}
            </select>
            <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px', margin: '8px 0 0 0' }}>
              {localConfig.responseLanguage === 'en' && '🤖 AI will respond in English'}
              {localConfig.responseLanguage === 'ru' && '🤖 ИИ будет отвечать на русском'}
              {localConfig.responseLanguage === 'uk' && '🤖 ШІ буде відповідати українською'}
            </p>
          </div>

          <div>
            <label 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px', 
                fontSize: '14px', 
                fontWeight: '500', 
                color: '#d1d5db',
                marginBottom: '12px'
              }}
            >
              <Eye style={{ width: '16px', height: '16px' }} />
              Opacity: {Math.round(localConfig.opacity * 100)}%
            </label>
            <input
              type="range"
              min="0.3"
              max="1"
              step="0.05"
              value={localConfig.opacity}
              onChange={(e) => handleOpacityChange(parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: '#3b82f6' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <label 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px', 
                fontSize: '14px', 
                fontWeight: '500', 
                color: '#d1d5db' 
              }}
            >
              <Pin style={{ width: '16px', height: '16px' }} />
              Always on Top
            </label>
            <button
              onClick={handleAlwaysOnTopChange}
              style={{
                position: 'relative',
                display: 'inline-flex',
                height: '24px',
                width: '44px',
                alignItems: 'center',
                borderRadius: '9999px',
                backgroundColor: localConfig.alwaysOnTop ? '#2563eb' : '#374151',
                border: 'none',
                cursor: 'pointer',
                transition: 'background-color 0.2s'
              }}
            >
              <span 
                style={{
                  display: 'inline-block',
                  height: '16px',
                  width: '16px',
                  borderRadius: '9999px',
                  backgroundColor: 'white',
                  transform: localConfig.alwaysOnTop ? 'translateX(24px)' : 'translateX(4px)',
                  transition: 'transform 0.2s'
                }}
              />
            </button>
          </div>

          <button
            onClick={handleSave}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '8px',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              backgroundColor: saved ? '#16a34a' : '#2563eb',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => {
              if (!saved) e.currentTarget.style.backgroundColor = '#1d4ed8';
            }}
            onMouseLeave={(e) => {
              if (!saved) e.currentTarget.style.backgroundColor = '#2563eb';
            }}
          >
            {saved ? (
              <>
                <CheckCircle style={{ width: '16px', height: '16px' }} />
                Saved!
              </>
            ) : (
              <>
                <Save style={{ width: '16px', height: '16px' }} />
                Save Settings
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}