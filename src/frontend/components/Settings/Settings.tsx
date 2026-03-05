import { useState, useEffect } from 'react';
import { X, Save, Eye, Pin, Languages, MessageSquare, CheckCircle, Key } from 'lucide-react';
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

  // ✅ Per-provider API key fields (not stored in main config, sent on save only)
  const [openaiKey, setOpenaiKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [claudeKey, setClaudeKey] = useState('');

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
    setLocalConfig({ ...localConfig, transcriptionLanguage: language });
  };

  const handleResponseLanguageChange = (language: string) => {
    setLocalConfig({ ...localConfig, responseLanguage: language });
  };

  const handleAIProviderChange = (provider: string) => {
    console.log('🤖 AI Provider changed to:', provider);
    // ✅ Reset aiModel to the first model of the new provider
    const providerObj = aiProviders.find(p => p.id === provider);
    setLocalConfig({
      ...localConfig,
      aiProvider: provider,
      aiModel: providerObj?.models[0] ?? localConfig.aiModel,
    });
  };

  const handleAIModelChange = (model: string) => {
    setLocalConfig({ ...localConfig, aiModel: model });
  };

  const handleSave = () => {
    console.log('💾 Saving config:', localConfig);
    updateConfig(localConfig);
    
    const socket = io('http://localhost:3001');
 
    const payload: Record<string, unknown> = {
      ...localConfig,
    };
    if (openaiKey.trim()) payload.openaiKey = openaiKey.trim();
    if (geminiKey.trim()) payload.geminiKey = geminiKey.trim();
    if (claudeKey.trim()) payload.claudeKey = claudeKey.trim();

    socket.emit('update-config', payload);
    
    socket.on('config-updated', (data: { success: boolean; activeProvider: string }) => {
      console.log('✅ Config updated on backend. Active provider:', data.activeProvider);
      socket.close();
    });
  
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleClose = () => {
    setShowSettings(false);
  };

  const languageOptions = [
    { code: 'en', label: '🇬🇧 English', name: 'English' },
    { code: 'ru', label: '🇷🇺 Русский', name: 'Russian' },
    { code: 'uk', label: '🇺🇦 Українська', name: 'Ukrainian' }
  ];

  const aiProviders = [
    { id: 'openai', name: 'OpenAI (ChatGPT)', icon: '🤖', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'], keyLabel: 'OpenAI API Key', keyPlaceholder: 'sk-...' },
    { id: 'gemini', name: 'Google Gemini', icon: '✨', models: ['gemini-2.0-flash-exp', 'gemini-1.5-flash', 'gemini-1.5-pro'], keyLabel: 'Gemini API Key', keyPlaceholder: 'AIza...' },
    { id: 'claude', name: 'Anthropic Claude', icon: '🧠', models: ['claude-sonnet-4-20250514', 'claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307', 'claude-3-opus-20240229'], keyLabel: 'Claude API Key', keyPlaceholder: 'sk-ant-...' }
  ];

  const currentProvider = aiProviders.find(p => p.id === (localConfig.aiProvider || 'openai'));
 
  const keyValueMap: Record<string, string> = {
    openai: openaiKey,
    gemini: geminiKey,
    claude: claudeKey,
  };

  const keySetterMap: Record<string, (v: string) => void> = {
    openai: setOpenaiKey,
    gemini: setGeminiKey,
    claude: setClaudeKey,
  };

  const activeProvider = localConfig.aiProvider || 'openai';

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 999999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        // @ts-ignore
        WebkitAppRegion: 'no-drag'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div 
        style={{
          position: 'relative',
          backgroundColor: '#111827',
          borderRadius: '16px',
          border: '1px solid #374151',
          width: '400px',
          maxHeight: '85vh',
          overflow: 'visible', 
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          zIndex: 1000000,
          // @ts-ignore
          WebkitAppRegion: 'no-drag'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          backgroundColor: '#1f2937',
          borderBottom: '1px solid #374151',
          padding: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: 'white', margin: 0 }}>
            Settings
          </h2>
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
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#374151'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <X style={{ width: '20px', height: '20px', color: '#9ca3af' }} />
          </button>
        </div>
 
        <div className="custom-scrollbar" style={{
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
          maxHeight: 'calc(85vh - 72px)',
          overflowY: 'auto',
          overflowX: 'hidden',
          borderRadius: '0 0 16px 16px',
          // @ts-ignore
          WebkitAppRegion: 'no-drag'
        }}>
 
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
              <strong>Active:</strong> {currentProvider?.icon} {currentProvider?.name} — {localConfig.aiModel || currentProvider?.models[0]}
            </div>
          </div>
 
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: '500', color: '#d1d5db', marginBottom: '12px' }}>
              <span style={{ fontSize: '18px' }}>🤖</span>
              AI Provider
            </label>
            <select
              value={localConfig.aiProvider || 'openai'}
              onChange={(e) => handleAIProviderChange(e.target.value)}
              style={selectStyle}
            >
              {aiProviders.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.icon} {provider.name}
                </option>
              ))}
            </select>
            <p style={hintStyle}>
              {activeProvider === 'openai' && '🤖 ChatGPT — Most popular, reliable'}
              {activeProvider === 'gemini' && '✨ Gemini — Fast, low cost'}
              {activeProvider === 'claude' && '🧠 Claude — Best for complex reasoning'}
            </p>
          </div>
 
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: '500', color: '#d1d5db', marginBottom: '12px' }}>
              <span style={{ fontSize: '18px' }}>🎯</span>
              AI Model
            </label>
            <select
              value={localConfig.aiModel || currentProvider?.models[0]}
              onChange={(e) => handleAIModelChange(e.target.value)}
              style={selectStyle}
            >
              {currentProvider?.models.map((model) => (
                <option key={model} value={model}>{model}</option>
              ))}
            </select>
          </div>
 
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: '500', color: '#d1d5db', marginBottom: '12px' }}>
              <Key style={{ width: '16px', height: '16px' }} />
              {currentProvider?.keyLabel}
            </label>
            <input
              type="password"
              placeholder={`Enter ${currentProvider?.keyPlaceholder} — leave blank to keep existing`}
              value={keyValueMap[activeProvider] || ''}
              onChange={(e) => keySetterMap[activeProvider]?.(e.target.value)}
              style={{
                ...selectStyle,
                fontFamily: 'monospace',
              }}
            />
            <p style={hintStyle}>
              🔑 Only fill this if you want to update the key. Leave blank to keep current.
            </p>
          </div>
 
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: '500', color: '#d1d5db', marginBottom: '12px' }}>
              <Languages style={{ width: '16px', height: '16px' }} />
              Transcription Language
            </label>
            <select
              value={localConfig.transcriptionLanguage || 'en'}
              onChange={(e) => handleTranscriptionLanguageChange(e.target.value)}
              style={selectStyle}
            >
              {languageOptions.map((lang) => (
                <option key={lang.code} value={lang.code}>{lang.label}</option>
              ))}
            </select>
          </div>
 
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: '500', color: '#d1d5db', marginBottom: '12px' }}>
              <MessageSquare style={{ width: '16px', height: '16px' }} />
              Response Language
            </label>
            <select
              value={localConfig.responseLanguage || 'en'}
              onChange={(e) => handleResponseLanguageChange(e.target.value)}
              style={selectStyle}
            >
              {languageOptions.map((lang) => (
                <option key={lang.code} value={lang.code}>{lang.label}</option>
              ))}
            </select>
          </div>
 
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: '500', color: '#d1d5db', marginBottom: '12px' }}>
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
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: '500', color: '#d1d5db' }}>
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
              <span style={{
                display: 'inline-block',
                height: '16px',
                width: '16px',
                borderRadius: '9999px',
                backgroundColor: 'white',
                transform: localConfig.alwaysOnTop ? 'translateX(24px)' : 'translateX(4px)',
                transition: 'transform 0.2s'
              }} />
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
            onMouseEnter={(e) => { if (!saved) e.currentTarget.style.backgroundColor = '#1d4ed8'; }}
            onMouseLeave={(e) => { if (!saved) e.currentTarget.style.backgroundColor = '#2563eb'; }}
          >
            {saved ? (
              <><CheckCircle style={{ width: '16px', height: '16px' }} /> Saved!</>
            ) : (
              <><Save style={{ width: '16px', height: '16px' }} /> Save Settings</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: '8px',
  border: '1px solid #374151',
  backgroundColor: '#1f2937',
  color: '#d1d5db',
  fontSize: '14px',
  cursor: 'pointer',
  outline: 'none',
};

const hintStyle: React.CSSProperties = {
  fontSize: '12px',
  color: '#6b7280',
  margin: '8px 0 0 0',
};