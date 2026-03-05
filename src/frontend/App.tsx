import { useEffect } from 'react';
import Overlay from './components/Overlay/Overlay';
import SettingsPanel from './components/Settings/Settings';
import { useVoiceStore } from './store/voiceStore';
import { useSocket } from './hooks/useSocket';

export default function App() {
  const { showSettings, setShowSettings, error } = useVoiceStore();
  useSocket();

  useEffect(() => {
    console.log('🔧 showSettings changed:', showSettings);
  }, [showSettings]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
 
      if (e.ctrlKey && e.shiftKey && e.code === 'KeyS') {
        e.preventDefault();
        console.log('⚙️ Keyboard shortcut: Toggle settings');
        setShowSettings(!showSettings);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showSettings, setShowSettings]);

  return (
    <>
    
  
    <div className="w-full h-full bg-gray-900 text-white font-sans relative">
      {error && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-red-600 text-white px-6 py-3 rounded-lg shadow-lg z-[100]">
          <p className="text-sm font-medium m-0">⚠️ {error}</p>
        </div>
      )}  
      
      <Overlay />
       </div>
      {showSettings && (
        <>
          {console.log('🔧 Rendering SettingsPanel')}
          <SettingsPanel />
        </>
      )}
     </>
  );
}