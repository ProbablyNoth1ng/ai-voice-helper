import { useCallback, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useVoiceStore } from '../store/voiceStore';
import { getModelLabel } from '../constants/aiProviders';

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

export const useSocket = () => {
  const socketRef = useRef<Socket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const activeCaptureModeRef = useRef<CaptureMode | null>(null);
  const activeTranscriptMessageIdRef = useRef<string | null>(null);
  const activeAssistantMessageIdRef = useRef<string | null>(null);
  const recordingPromiseRef = useRef<{
    resolve: (blob: Blob) => void;
    reject: (error: Error) => void;
  } | null>(null);

  const {
    setState,
    addMessage,
    appendToMessage,
    upsertMessage,
    setError,
    setShowSettings,
    updateConfig,
  } = useVoiceStore();

  const resetStreamingMessageRefs = useCallback(() => {
    activeTranscriptMessageIdRef.current = null;
    activeAssistantMessageIdRef.current = null;
  }, []);

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
              audioChunksRef.current.push(event.data);
            }
          };

          mediaRecorder.onstop = () => {
            stream.getTracks().forEach((track) => track.stop());
            const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });

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

      setState('processing');

      try {
        const audioBuffer = await audioBlob.arrayBuffer();
        socket.emit('process-audio', { audio: audioBuffer });
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to read audio';
        setError(errorMessage);
        setState('idle');
      }
    },
    [setError, setState],
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

      setState('processing');

      try {
        const audioBuffer = await audioBlob.arrayBuffer();
        socket.emit('process-coding-task', { audio: audioBuffer, screenshot });
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to read audio';
        setError(errorMessage);
        setState('idle');
      }
    },
    [setError, setState],
  );

  const handleHotkeyPress = useCallback(async () => {
    const currentState = useVoiceStore.getState().state;
    const socket = socketRef.current;

    if (!socket?.connected) {
      setError('Not connected to backend');
      return;
    }

    if (currentState === 'idle') {
      activeCaptureModeRef.current = 'voice';
      resetStreamingMessageRefs();
      setState('listening');
      setError(null);

      try {
        const audioBlob = await startRecording('virtual');
        if (activeCaptureModeRef.current === 'voice') {
          activeCaptureModeRef.current = null;
          void sendAudioToBackend(audioBlob);
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Recording failed';
        activeCaptureModeRef.current = null;
        setError(errorMessage);
        setState('idle');
      }
    } else if (currentState === 'listening') {
      stopRecording();
    }
  }, [resetStreamingMessageRefs, sendAudioToBackend, setError, setState, startRecording, stopRecording]);

  const handleCodingHotkeyPress = useCallback(async () => {
    const currentState = useVoiceStore.getState().state;
    const socket = socketRef.current;

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
      resetStreamingMessageRefs();
      setError(null);

      try {
        const screenshot = await window.electronAPI.captureCodingScreenshot();
        if (!screenshot) {
          throw new Error('Screenshot capture failed');
        }

        setState('listening');
        const audioBlob = await startRecording('virtual');

        if (activeCaptureModeRef.current === 'coding') {
          activeCaptureModeRef.current = null;
          void sendCodingTaskToBackend(audioBlob, screenshot);
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Coding capture failed';
        activeCaptureModeRef.current = null;
        setError(errorMessage);
        setState('idle');
      }
    } else if (currentState === 'listening') {
      stopRecording();
    }
  }, [resetStreamingMessageRefs, sendCodingTaskToBackend, setError, setState, startRecording, stopRecording]);

  const handleToggleSettings = useCallback(() => {
    const currentShowSettings = useVoiceStore.getState().showSettings;
    setShowSettings(!currentShowSettings);
  }, [setShowSettings]);

  useEffect(() => {
    const socket = io(BACKEND_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setError(null);
      socket.emit('get-config');
    });

    socket.on('current-config', (config: any) => {
      updateConfig(config);
    });

    socket.on('model-switched', ({ provider, model }: { provider: string; model: string }) => {
      const providerName = provider === 'openai' ? 'OpenAI' : provider;
      const modelLabel = getModelLabel(provider, model);
      addMessage({
        id: `system-${Date.now()}`,
        text: `Switched ${providerName} model to ${modelLabel} (${model}).`,
        type: 'system',
        timestamp: Date.now(),
      });
    });

    socket.on('connect_error', (error: Error) => {
      console.error('Connection error:', error.message);
      setError('Cannot connect to backend');
    });

    socket.on('state-change', ({ state }: { state: string }) => {
      setState(state as 'idle' | 'listening' | 'processing');
    });

    socket.on('transcript-chunk', ({ text }: { text: string }) => {
      if (!text) {
        return;
      }

      if (!activeTranscriptMessageIdRef.current) {
        activeTranscriptMessageIdRef.current = `user-${Date.now()}`;
      }

      appendToMessage(activeTranscriptMessageIdRef.current, text, 'user');
    });

    socket.on('transcript', ({ text }: { text: string }) => {
      const id = activeTranscriptMessageIdRef.current || `user-${Date.now()}`;
      activeTranscriptMessageIdRef.current = id;
      upsertMessage({
        id,
        text,
        type: 'user',
        timestamp: Date.now(),
      });
    });

    socket.on('ai-response-start', () => {
      activeAssistantMessageIdRef.current = activeAssistantMessageIdRef.current || `assistant-${Date.now()}`;
    });

    socket.on('ai-response-chunk', ({ text }: { text: string }) => {
      if (!text) {
        return;
      }

      if (!activeAssistantMessageIdRef.current) {
        activeAssistantMessageIdRef.current = `assistant-${Date.now()}`;
      }

      appendToMessage(activeAssistantMessageIdRef.current, text, 'assistant');
    });

    socket.on('ai-response-done', ({ text }: { text: string }) => {
      const id = activeAssistantMessageIdRef.current || `assistant-${Date.now()}`;
      activeAssistantMessageIdRef.current = id;
      upsertMessage({
        id,
        text,
        type: 'assistant',
        timestamp: Date.now(),
      });
    });

    socket.on('ai-response', ({ text }: { text: string }) => {
      if (!activeAssistantMessageIdRef.current) {
        addMessage({
          id: Date.now().toString(),
          text,
          type: 'assistant',
          timestamp: Date.now(),
        });
      }
    });

    socket.on('error', ({ message }: { message: string }) => {
      activeCaptureModeRef.current = null;
      setError(message);
      setState('idle');
    });

    if (!isElectron) {
      socket.on('hotkey-pressed', handleHotkeyPress);
    }

    if (isElectron && window.electronAPI && !electronListenersRegistered) {
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
    addMessage,
    appendToMessage,
    handleCodingHotkeyPress,
    handleHotkeyPress,
    handleToggleSettings,
    setError,
    setState,
    stopRecording,
    updateConfig,
    upsertMessage,
  ]);

  return socketRef.current;
};
