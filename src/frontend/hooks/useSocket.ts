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

let electronListenersRegistered = false;

export const useSocket = () => {
  const socketRef = useRef<Socket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingPromiseRef = useRef<{
    resolve: (blob: Blob) => void;
    reject: (error: Error) => void;
  } | null>(null);

  const { setState, addMessage, setError, setShowSettings, updateConfig } = useVoiceStore();

  const startRecording = useCallback((): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      console.log('🎤 Starting desktop audio recording via VB-CABLE...');

      recordingPromiseRef.current = { resolve, reject };

      navigator.mediaDevices.enumerateDevices()
        .then(devices => {
          console.log('📱 Available devices:', devices.filter(d => d.kind === 'audioinput'));
          
          const vbCableDevice = devices.find(device => 
            device.kind === 'audioinput' && 
            (device.label.toLowerCase().includes('cable') || 
             device.label.toLowerCase().includes('vb-audio') ||
             device.label.toLowerCase().includes('virtual'))
          );

          if (vbCableDevice) {
            console.log('✅ Found VB-CABLE device:', vbCableDevice.label);
          } else {
            console.warn('⚠️ VB-CABLE not found, using default input');
          }

          const constraints: MediaStreamConstraints = {
            audio: {
              deviceId: vbCableDevice ? { exact: vbCableDevice.deviceId } : undefined,
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl: false,
              sampleRate: 16000,
              channelCount: 1
            }
          };

          return navigator.mediaDevices.getUserMedia(constraints);
        })
        .then((stream) => {
          console.log('✅ Desktop audio access granted');
          audioChunksRef.current = [];

          const mediaRecorder = new MediaRecorder(stream, {
            mimeType: 'audio/webm;codecs=opus',
            audioBitsPerSecond: 16000
          });

          mediaRecorderRef.current = mediaRecorder;

          mediaRecorder.ondataavailable = (event: BlobEvent) => {
            if (event.data.size > 0) {
              console.log('📊 Audio chunk received:', event.data.size, 'bytes');
              audioChunksRef.current.push(event.data);
            }
          };

          mediaRecorder.onstop = () => {
            console.log('⏹️ Recording stopped');
            stream.getTracks().forEach(track => track.stop());

            const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
            console.log('📦 Final audio blob size:', audioBlob.size, 'bytes');

            if (recordingPromiseRef.current) {
              recordingPromiseRef.current.resolve(audioBlob);
              recordingPromiseRef.current = null;
            }
          };

          mediaRecorder.onerror = (error) => {
            console.error('❌ MediaRecorder error:', error);
            if (recordingPromiseRef.current) {
              recordingPromiseRef.current.reject(new Error('Recording failed'));
              recordingPromiseRef.current = null;
            }
          };

          mediaRecorder.start(100);
          console.log('🔴 Desktop audio recording started');
        })
        .catch((err: Error) => {
          console.error('❌ Failed to start recording:', err);
          
          let errorMsg = `Desktop audio capture error: ${err.message}`;
          
          if (err.name === 'NotFoundError') {
            errorMsg = 'VB-CABLE not found. Please install and configure VB-CABLE.';
          } else if (err.name === 'NotAllowedError') {
            errorMsg = 'Microphone permission denied.';
          } else if (err.name === 'NotReadableError') {
            errorMsg = 'Audio device is busy.';
          }
          
          reject(new Error(errorMsg));
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

    if (audioBlob.size < 1000) {
      setError('Recording too short or no audio detected.');
      setState('idle');
      return;
    }

    console.log('📤 Sending audio to backend:', audioBlob.size, 'bytes');
    setState('processing');

    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        const base64Audio = result.split(',')[1];
        console.log('📤 Base64 audio length:', base64Audio.length);
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
    } else if (currentState === 'listening') {
      console.log('⏹️ Stopping recording...');
      stopRecording();
    } else if (currentState === 'processing') {
      console.log('⏳ Already processing, please wait...');
    }
  }, [setState, setError, startRecording, stopRecording, sendAudioToBackend]);

  const handleToggleSettings = useCallback(() => {
    const currentShowSettings = useVoiceStore.getState().showSettings;
    console.log('⚙️ Toggling settings:', !currentShowSettings);
    setShowSettings(!currentShowSettings);
  }, [setShowSettings]);

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
      
      socket.emit('get-config');
    });

    socket.on('current-config', (config: any) => {
      console.log('🌍 Received config from backend:', JSON.stringify(config));
      updateConfig(config);
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

    socket.on('ai-response', ({ text, language }: { text: string; language?: string }) => {
      console.log('🤖 AI Response:', text);
      console.log('🌍 Response language:', language);
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

    if (isElectron && window.electronAPI && !electronListenersRegistered) {
      console.log('⚡ Setting up Electron hotkeys');
      electronListenersRegistered = true;
      
      window.electronAPI.onHotkeyPressed(handleHotkeyPress);
      window.electronAPI.onToggleSettings(handleToggleSettings);
    }

    return () => {
      socket.close();
      stopRecording();
    };
  }, [setState, addMessage, setError, updateConfig, handleHotkeyPress, handleToggleSettings, stopRecording]);

  return socketRef.current;
};