import { useState, useEffect } from 'react';
import { X, Save, Eye, Pin } from 'lucide-react';
import { useVoiceStore } from '../../store/voiceStore';
import { io } from 'socket.io-client';

export default function SettingsPanel() {
  const { config, updateConfig, setShowSettings } = useVoiceStore();
  const [localConfig, setLocalConfig] = useState(config);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    console.log('⚙️ SettingsPanel mounted');
    return () => console.log('⚙️ SettingsPanel unmounted');
  }, []);

  const handleSave = () => {
    updateConfig(localConfig);
    
    const socket = io('http://localhost:3001');
    socket.emit('update-config', localConfig);
    socket.close();
  
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleClose = () => {
    console.log('⚙️ Closing settings');
    setShowSettings(false);
  };

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
        backgroundColor: 'rgba(0, 0, 0, 0.5)'
      }}
    >
      {/* Backdrop - click to close */}
      <div 
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0
        }}
        onClick={handleClose}
      />
      
      {/* Settings Panel */}
      <div 
        style={{
          position: 'relative',
          backgroundColor: '#111827',
          borderRadius: '16px',
          border: '1px solid #374151',
          width: '384px',
          maxHeight: '80vh',
          overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
        }}
      >
        {/* Header */}
        <div 
          style={{
            backgroundColor: '#1f2937',
            borderBottom: '1px solid #374151',
            padding: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
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
              justifyContent: 'center'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#374151'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <X style={{ width: '20px', height: '20px', color: '#9ca3af' }} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Opacity Slider */}
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
              onChange={(e) => setLocalConfig({ ...localConfig, opacity: parseFloat(e.target.value) })}
              style={{ width: '100%', accentColor: '#3b82f6' }}
            />
          </div>

          {/* Always on Top Toggle */}
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
              onClick={() => setLocalConfig({ ...localConfig, alwaysOnTop: !localConfig.alwaysOnTop })}
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

          {/* Save Button */}
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
            <Save style={{ width: '16px', height: '16px' }} />
            {saved ? 'Saved!' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}