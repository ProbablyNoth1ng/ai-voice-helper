import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useVoiceStore } from '../store/voiceStore';

interface ElectronAPI {
  onHotkeyPressed: (callback: () => void) => void;
  onToggleSettings: (callback: () => void) => void;
  hideWindow: () => void;
  showWindow: () => void;
  setAlwaysOnTop: (value: boolean) => void;
  setOpacity: (value: number) => void;
  isElectron: boolean;
}

interface WindowWithElectron extends Window {
  electronAPI?: ElectronAPI;
}

declare const window: WindowWithElectron;

const BACKEND_URL = 'http://localhost:3001';
const isElectron = !!window.electronAPI;

export const useSocket = () => {
  const socketRef = useRef<Socket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingPromiseRef = useRef<{
    resolve: (blob: Blob) => void;
    reject: (error: Error) => void;
  } | null>(null);

  const { setState, addMessage, setError, setShowSettings } = useVoiceStore();
 
  const startRecording = useCallback((): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      console.log('🎤 Starting audio recording...');
 
      recordingPromiseRef.current = { resolve, reject };

      navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          sampleRate: 16000
        } 
      })
      .then((stream) => {
        console.log('✅ Microphone access granted');

        audioChunksRef.current = [];
        
        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: 'audio/webm;codecs=opus'
        });
        
        mediaRecorderRef.current = mediaRecorder;

        mediaRecorder.ondataavailable = (event: BlobEvent) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = () => {
          console.log('⏹️ Recording stopped');
          stream.getTracks().forEach(track => track.stop());
          
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          console.log('📦 Audio blob size:', audioBlob.size);
           
          if (recordingPromiseRef.current) {
            recordingPromiseRef.current.resolve(audioBlob);
            recordingPromiseRef.current = null;
          }
        };

        mediaRecorder.onerror = () => {
          console.error('❌ MediaRecorder error');
          if (recordingPromiseRef.current) {
            recordingPromiseRef.current.reject(new Error('Recording failed'));
            recordingPromiseRef.current = null;
          }
        };

        mediaRecorder.start(50); 
        console.log('🔴 Recording started... Press hotkey again to stop.');
      })
      .catch((err: Error) => {
        console.error('❌ Failed to start recording:', err);
        reject(new Error(`Microphone error: ${err.message}`));
      });
    });
  }, []);
 
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      console.log('⏹️ Stopping recording...');
      mediaRecorderRef.current.stop();
    }
  }, []);
 
  const sendAudioToBackend = useCallback((audioBlob: Blob) => {
    const socket = socketRef.current;
    if (!socket?.connected) {
      setError('Not connected to backend');
      setState('idle');
      return;
    }

    if (audioBlob.size < 100) {
      setError('Recording too short. Speak longer.');
      setState('idle');
      return;
    }

    setState('processing');

    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        const base64Audio = result.split(',')[1];
        console.log('📤 Sending audio to backend...');
        socket.emit('process-audio', { audio: base64Audio });
      }
    };
    reader.onerror = () => {
      setError('Failed to read audio');
      setState('idle');
    };
    reader.readAsDataURL(audioBlob);
  }, [setState, setError]);
 
  const handleHotkeyPress = useCallback(async () => {
    const currentState = useVoiceStore.getState().state;
    const socket = socketRef.current;

    console.log('⌨️ Hotkey pressed! Current state:', currentState);

    if (!socket?.connected) {
      setError('Not connected to backend');
      return;
    }
 
    if (currentState === 'idle') {
      setState('listening');
      setError(null);

      try { 
        const audioBlob = await startRecording();
         
        sendAudioToBackend(audioBlob);

      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Recording failed';
        console.error('❌ Recording failed:', errorMessage);
        setError(errorMessage);
        setState('idle');
      }
    } 
    else if (currentState === 'listening') {
      console.log('⏹️ Stopping recording...');
      stopRecording(); 
    } 
    else if (currentState === 'processing') {
      console.log('⏳ Already processing, please wait...');
    }
  }, [setState, setError, startRecording, stopRecording, sendAudioToBackend]);

  useEffect(() => {
    console.log('🔌 Connecting to', BACKEND_URL);

    const socket = io(BACKEND_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('✅ Connected:', socket.id);
      setError(null);
    });

    socket.on('connect_error', (error: Error) => {
      console.error('❌ Connection error:', error.message);
      setError('Cannot connect to backend');
    });

    socket.on('state-change', ({ state }: { state: string }) => {
      console.log('🔄 State:', state);
      setState(state as 'idle' | 'listening' | 'processing');
    });

    socket.on('transcript', ({ text }: { text: string }) => {
      console.log('📝 Transcript:', text);
      addMessage({
        id: Date.now().toString(),
        text,
        type: 'user',
        timestamp: Date.now()
      });
    });

    socket.on('ai-response', ({ text }: { text: string }) => {
      console.log('🤖 AI:', text);
      addMessage({
        id: Date.now().toString(),
        text,
        type: 'assistant',
        timestamp: Date.now()
      });
    });

    socket.on('error', ({ message }: { message: string }) => {
      console.error('❌ Error:', message);
      setError(message);
      setState('idle');
    });
  
    if (!isElectron) {
      socket.on('hotkey-pressed', handleHotkeyPress);
    }
 
    if (isElectron && window.electronAPI) {
      console.log('⚡ Using Electron hotkeys');
      window.electronAPI.onHotkeyPressed(handleHotkeyPress);
      window.electronAPI.onToggleSettings(() => {
        setShowSettings(!useVoiceStore.getState().showSettings);
      });
    }

    return () => {
      socket.close();
      stopRecording();
    };
  }, [setState, addMessage, setError, setShowSettings, handleHotkeyPress, stopRecording]);

  return socketRef.current;
};