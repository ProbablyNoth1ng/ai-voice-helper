import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useVoiceStore } from '../store/voiceStore';

type CaptureMode = 'voice' | 'coding';
type RecordingSource = 'virtual' | 'microphone';

interface ElectronAPI {
  onHotkeyPressed: (callback: () => void) => void;
  onCodingHotkeyPressed: (callback: () => void) => void;
  onToggleSettings: (callback: () => void) => void;
  hideWindow: () => void;
  showWindow: () => void;
  setAlwaysOnTop: (value: boolean) => void;
  setOpacity: (value: number) => void;
  captureCodingScreenshot: () => Promise<string>;
  isElectron: boolean;
}

interface WindowWithElectron extends Window {
  electronAPI?: ElectronAPI;
}

declare const window: WindowWithElectron;

const BACKEND_URL = 'http://localhost:3001';
const isElectron = !!window.electronAPI;

let electronListenersRegistered = false;

const readBlobAsBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Failed to read audio'));
        return;
      }
      resolve(result.split(',')[1]);
    };
    reader.onerror = () => reject(new Error('Failed to read audio'));
    reader.readAsDataURL(blob);
  });

export const useSocket = () => {
  const socketRef = useRef<Socket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const activeCaptureModeRef = useRef<CaptureMode | null>(null);
  const codingScreenshotRef = useRef<string | null>(null);
  const recordingPromiseRef = useRef<{
    resolve: (blob: Blob) => void;
    reject: (error: Error) => void;
  } | null>(null);

  const { setState, addMessage, setError, setShowSettings, updateConfig } = useVoiceStore();

  const startRecording = useCallback((source: RecordingSource): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      console.log(`Starting ${source} audio recording...`);

      recordingPromiseRef.current = { resolve, reject };

      const getStream =
        source === 'virtual'
          ? navigator.mediaDevices.enumerateDevices().then((devices) => {
              console.log('Available audio inputs:', devices.filter((d) => d.kind === 'audioinput'));

              const virtualDevice = devices.find(
                (device) =>
                  device.kind === 'audioinput' &&
                  (device.label.toLowerCase().includes('cable') ||
                    device.label.toLowerCase().includes('vb-audio') ||
                    device.label.toLowerCase().includes('virtual')),
              );

              if (virtualDevice) {
                console.log('Found virtual audio device:', virtualDevice.label);
              } else {
                console.warn('Virtual audio device not found, using default input');
              }

              const constraints: MediaStreamConstraints = {
                audio: {
                  deviceId: virtualDevice ? { exact: virtualDevice.deviceId } : undefined,
                  echoCancellation: false,
                  noiseSuppression: false,
                  autoGainControl: false,
                  sampleRate: 16000,
                  channelCount: 1,
                },
              };

              return navigator.mediaDevices.getUserMedia(constraints);
            })
          : navigator.mediaDevices.getUserMedia({
              audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
                sampleRate: 16000,
                channelCount: 1,
              },
            });

      getStream
        .then((stream) => {
          console.log(`${source} audio access granted`);
          audioChunksRef.current = [];

          const mediaRecorder = new MediaRecorder(stream, {
            mimeType: 'audio/webm;codecs=opus',
            audioBitsPerSecond: 16000,
          });

          mediaRecorderRef.current = mediaRecorder;

          mediaRecorder.ondataavailable = (event: BlobEvent) => {
            if (event.data.size > 0) {
              console.log('Audio chunk received:', event.data.size, 'bytes');
              audioChunksRef.current.push(event.data);
            }
          };

          mediaRecorder.onstop = () => {
            console.log('Recording stopped');
            stream.getTracks().forEach((track) => track.stop());

            const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
            console.log('Final audio blob size:', audioBlob.size, 'bytes');

            if (recordingPromiseRef.current) {
              recordingPromiseRef.current.resolve(audioBlob);
              recordingPromiseRef.current = null;
            }
          };

          mediaRecorder.onerror = () => {
            if (recordingPromiseRef.current) {
              recordingPromiseRef.current.reject(new Error('Recording failed'));
              recordingPromiseRef.current = null;
            }
          };

          mediaRecorder.start(100);
          console.log(`${source} audio recording started`);
        })
        .catch((err: Error) => {
          console.error('Failed to start recording:', err);

          let errorMsg = `${source === 'virtual' ? 'Desktop' : 'Microphone'} audio capture error: ${err.message}`;

          if (source === 'virtual' && err.name === 'NotFoundError') {
            errorMsg = 'VB-CABLE not found. Please install and configure VB-CABLE.';
          } else if (err.name === 'NotAllowedError') {
            errorMsg = 'Microphone permission denied.';
          } else if (err.name === 'NotReadableError') {
            errorMsg = 'Audio device is busy.';
          }

          recordingPromiseRef.current = null;
          reject(new Error(errorMsg));
        });
    });
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      console.log('Stopping recording...');
      mediaRecorderRef.current.stop();
    }
  }, []);

  const sendAudioToBackend = useCallback(
    async (audioBlob: Blob) => {
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

      console.log('Sending audio to backend:', audioBlob.size, 'bytes');
      setState('processing');

      try {
        const base64Audio = await readBlobAsBase64(audioBlob);
        console.log('Base64 audio length:', base64Audio.length);
        socket.emit('process-audio', { audio: base64Audio });
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to read audio';
        setError(errorMessage);
        setState('idle');
      }
    },
    [setState, setError],
  );

  const sendCodingTaskToBackend = useCallback(
    async (audioBlob: Blob, screenshot: string) => {
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

      if (!screenshot) {
        setError('Screenshot capture failed.');
        setState('idle');
        return;
      }

      console.log('Sending coding task to backend:', audioBlob.size, 'bytes');
      setState('processing');

      try {
        const base64Audio = await readBlobAsBase64(audioBlob);
        socket.emit('process-coding-task', { audio: base64Audio, screenshot });
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to read audio';
        setError(errorMessage);
        setState('idle');
      }
    },
    [setState, setError],
  );

  const handleHotkeyPress = useCallback(async () => {
    const currentState = useVoiceStore.getState().state;
    const socket = socketRef.current;

    console.log('Voice hotkey pressed. Current state:', currentState);

    if (!socket?.connected) {
      setError('Not connected to backend');
      return;
    }

    if (currentState === 'idle') {
      activeCaptureModeRef.current = 'voice';
      setState('listening');
      setError(null);

      try {
        const audioBlob = await startRecording('virtual');
        if (activeCaptureModeRef.current === 'voice') {
          activeCaptureModeRef.current = null;
          sendAudioToBackend(audioBlob);
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Recording failed';
        console.error('Recording failed:', errorMessage);
        activeCaptureModeRef.current = null;
        setError(errorMessage);
        setState('idle');
      }
    } else if (currentState === 'listening') {
      stopRecording();
    } else if (currentState === 'processing') {
      console.log('Already processing, please wait...');
    }
  }, [setState, setError, startRecording, stopRecording, sendAudioToBackend]);

  const handleCodingHotkeyPress = useCallback(async () => {
    const currentState = useVoiceStore.getState().state;
    const socket = socketRef.current;

    console.log('Coding hotkey pressed. Current state:', currentState);

    if (!socket?.connected) {
      setError('Not connected to backend');
      return;
    }

    if (!window.electronAPI) {
      setError('Coding screenshot capture is only available in Electron.');
      return;
    }

    if (currentState === 'idle') {
      activeCaptureModeRef.current = 'coding';
      setError(null);

      try {
        const screenshot = await window.electronAPI.captureCodingScreenshot();
        codingScreenshotRef.current = screenshot;
        setState('listening');

        const audioBlob = await startRecording('microphone');
        if (activeCaptureModeRef.current === 'coding') {
          activeCaptureModeRef.current = null;
          const savedScreenshot = codingScreenshotRef.current;
          codingScreenshotRef.current = null;
          sendCodingTaskToBackend(audioBlob, savedScreenshot || '');
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Coding capture failed';
        console.error('Coding capture failed:', errorMessage);
        activeCaptureModeRef.current = null;
        codingScreenshotRef.current = null;
        setError(errorMessage);
        setState('idle');
      }
    } else if (currentState === 'listening') {
      stopRecording();
    } else if (currentState === 'processing') {
      console.log('Already processing, please wait...');
    }
  }, [setState, setError, startRecording, stopRecording, sendCodingTaskToBackend]);

  const handleToggleSettings = useCallback(() => {
    const currentShowSettings = useVoiceStore.getState().showSettings;
    console.log('Toggling settings:', !currentShowSettings);
    setShowSettings(!currentShowSettings);
  }, [setShowSettings]);

  useEffect(() => {
    console.log('Connecting to', BACKEND_URL);

    const socket = io(BACKEND_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Connected:', socket.id);
      setError(null);
      socket.emit('get-config');
    });

    socket.on('current-config', (config: any) => {
      console.log('Received config from backend:', JSON.stringify(config));
      updateConfig(config);
    });

    socket.on('connect_error', (error: Error) => {
      console.error('Connection error:', error.message);
      setError('Cannot connect to backend');
    });

    socket.on('state-change', ({ state }: { state: string }) => {
      console.log('State:', state);
      setState(state as 'idle' | 'listening' | 'processing');
    });

    socket.on('transcript', ({ text }: { text: string }) => {
      console.log('Transcript:', text);
      addMessage({
        id: Date.now().toString(),
        text,
        type: 'user',
        timestamp: Date.now(),
      });
    });

    socket.on('ai-response', ({ text, language }: { text: string; language?: string }) => {
      console.log('AI Response:', text);
      console.log('Response language:', language);
      addMessage({
        id: Date.now().toString(),
        text,
        type: 'assistant',
        timestamp: Date.now(),
      });
    });

    socket.on('error', ({ message }: { message: string }) => {
      console.error('Error:', message);
      activeCaptureModeRef.current = null;
      codingScreenshotRef.current = null;
      setError(message);
      setState('idle');
    });

    if (!isElectron) {
      socket.on('hotkey-pressed', handleHotkeyPress);
    }

    if (isElectron && window.electronAPI && !electronListenersRegistered) {
      console.log('Setting up Electron hotkeys');
      electronListenersRegistered = true;

      window.electronAPI.onHotkeyPressed(handleHotkeyPress);
      window.electronAPI.onCodingHotkeyPressed(handleCodingHotkeyPress);
      window.electronAPI.onToggleSettings(handleToggleSettings);
    }

    return () => {
      socket.close();
      stopRecording();
    };
  }, [
    setState,
    addMessage,
    setError,
    updateConfig,
    handleHotkeyPress,
    handleCodingHotkeyPress,
    handleToggleSettings,
    stopRecording,
  ]);

  return socketRef.current;
};
