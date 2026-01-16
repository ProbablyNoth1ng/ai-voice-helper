import React, { useState } from 'react';
import { X, Save, Key, Mic, Zap, Eye, Pin } from 'lucide-react';
import { useVoiceStore } from '../../store/voiceStore';
import { io } from 'socket.io-client';

export default function SettingsPanel() {
  const { config, updateConfig, setShowSettings } = useVoiceStore();
  const [localConfig, setLocalConfig] = useState(config);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    updateConfig(localConfig);
    
    const socket = io('http://localhost:3001');
    socket.emit('update-config', localConfig);
    socket.close();
  
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="fixed top-8 right-8 pointer-events-auto z-50">
      <div className="bg-gray-900 bg-opacity-95 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-700 w-96 max-h-[80vh] overflow-y-auto custom-scrollbar">
        <div className="sticky top-0 bg-gray-900 border-b border-gray-700 p-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Settings</h2>
          <button
            onClick={() => setShowSettings(false)}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="p-6 space-y-6">


          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
              <Eye className="w-4 h-4" />
              Opacity: {Math.round(localConfig.opacity * 100)}%
            </label>
            <input
              type="range"
              min="0.3"
              max="1"
              step="0.05"
              value={localConfig.opacity}
              onChange={(e) => setLocalConfig({ ...localConfig, opacity: parseFloat(e.target.value) })}
              className="w-full"
            />
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
              <Pin className="w-4 h-4" />
              Always on Top
            </label>
            <button
              onClick={() => setLocalConfig({ ...localConfig, alwaysOnTop: !localConfig.alwaysOnTop })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                localConfig.alwaysOnTop ? 'bg-blue-600' : 'bg-gray-700'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                localConfig.alwaysOnTop ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>

          <button
            onClick={handleSave}
            className={`w-full py-3 rounded-lg font-medium transition-all ${
              saved ? 'bg-green-600 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Save className="w-4 h-4" />
              {saved ? 'Saved!' : 'Save Settings'}
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
