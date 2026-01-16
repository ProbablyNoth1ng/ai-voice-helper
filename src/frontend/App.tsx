import { useEffect } from 'react';
import Overlay from './components/Overlay/Overlay';
import SettingsPanel from './components/Settings/Settings';
import { useVoiceStore } from './store/voiceStore';
import { useSocket } from './hooks/useSocket';

export default function App() {
  const { showSettings, setShowSettings, error } = useVoiceStore();
  useSocket();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { 
      if (e.ctrlKey && e.shiftKey && e.code === 'KeyS') {
        e.preventDefault();
        setShowSettings(!showSettings);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showSettings, setShowSettings]);

  return (
    <div className="app-container">
      {error && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-red-600 text-white px-6 py-3 rounded-lg shadow-lg z-[9999] pointer-events-auto">
          <p className="text-sm font-medium">⚠️ {error}</p>
        </div>
      )}
      
      <Overlay />
      {showSettings && <SettingsPanel />}
    </div>
  );
}