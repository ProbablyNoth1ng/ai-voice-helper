import { useCallback, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { getModelLabel } from '../constants/aiProviders';
import { useVoiceStore } from '../store/voiceStore';

type CaptureMode = 'voice' | 'coding';
type RecordingSource = 'interviewer' | 'microphone';

interface ElectronAPI {
  onHotkeyPressed: (callback: () => void) => void;
  onMicrophoneHotkeyPressed: (callback: () => void) => void;
  onCodingHotkeyPressed: (callback: () => void) => void;
  onMicrophoneCodingHotkeyPressed: (callback: () => void) => void;
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

interface ActiveCapture {
  mode: CaptureMode;
  source: RecordingSource;
}

declare const window: WindowWithElectron;

const BACKEND_URL = 'http://localhost:3001';
const isElectron = !!window.electronAPI;
const MISSING_MICROPHONE_ERRORS = new Set(['NotFoundError', 'OverconstrainedError']);

let electronListenersRegistered = false;

export const useSocket = () => {
  const socketRef = useRef<Socket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const activeCaptureRef = useRef<ActiveCapture | null>(null);
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

  const syncMicrophoneSelection = useCallback(
    (deviceId?: string, deviceLabel?: string) => {
      updateConfig({
        microphoneDeviceId: deviceId,
        microphoneDeviceLabel: deviceLabel,
      });

      const socket = socketRef.current;
      if (socket?.connected) {
        socket.emit('update-config', {
          microphoneDeviceId: deviceId || '',
          microphoneDeviceLabel: deviceLabel || '',
        });
      }
    },
    [updateConfig],
  );

  const requestInterviewerStream = useCallback(async () => {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const interviewDevice = devices.find(
      (device) =>
        device.kind === 'audioinput' &&
        (device.label.toLowerCase().includes('cable') ||
          device.label.toLowerCase().includes('vb-audio') ||
          device.label.toLowerCase().includes('virtual')),
    );

    if (!interviewDevice) {
      throw new Error('Interviewer audio device not found. Configure VB-CABLE or another virtual audio input.');
    }

    return navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: { exact: interviewDevice.deviceId },
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        sampleRate: 16000,
        channelCount: 1,
      },
    });
  }, []);

  const requestMicrophoneStream = useCallback(async () => {
    const { microphoneDeviceId, microphoneDeviceLabel } = useVoiceStore.getState().config;

    const buildConstraints = (deviceId?: string): MediaStreamConstraints => ({
      audio: {
        deviceId: deviceId ? { exact: deviceId } : undefined,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 16000,
        channelCount: 1,
      },
    });

    const requestStream = (deviceId?: string) =>
      navigator.mediaDevices.getUserMedia(buildConstraints(deviceId));

    try {
      return await requestStream(microphoneDeviceId);
    } catch (err) {
      if (!(err instanceof Error) || !microphoneDeviceId || !MISSING_MICROPHONE_ERRORS.has(err.name)) {
        throw err;
      }

      addMessage({
        id: `system-${Date.now()}`,
        text: microphoneDeviceLabel
          ? `Microphone "${microphoneDeviceLabel}" is unavailable. Using the system default microphone.`
          : 'Selected microphone is unavailable. Using the system default microphone.',
        type: 'system',
        timestamp: Date.now(),
      });

      syncMicrophoneSelection(undefined, undefined);
      return requestStream();
    }
  }, [addMessage, syncMicrophoneSelection]);

  const startRecording = useCallback(
    (source: RecordingSource): Promise<Blob> => {
      return new Promise((resolve, reject) => {
        console.log(`Starting ${source} audio recording...`);
        recordingPromiseRef.current = { resolve, reject };

        const getStream =
          source === 'interviewer' ? requestInterviewerStream() : requestMicrophoneStream();

        getStream
          .then((stream) => {
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
          .catch((err: unknown) => {
            console.error('Failed to start recording:', err);

            let errorMsg = err instanceof Error ? err.message : 'Recording failed';

            if (err instanceof Error) {
              if (source === 'microphone' && err.name === 'NotAllowedError') {
                errorMsg = 'Microphone permission denied.';
              } else if (err.name === 'NotReadableError') {
                errorMsg = 'Audio device is busy.';
              } else if (source === 'microphone' && MISSING_MICROPHONE_ERRORS.has(err.name)) {
                errorMsg = 'Selected microphone is unavailable.';
              }
            }

            recordingPromiseRef.current = null;
            reject(new Error(errorMsg));
          });
      });
    },
    [requestInterviewerStream, requestMicrophoneStream],
  );

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

  const toggleCapture = useCallback(
    async (mode: CaptureMode, source: RecordingSource) => {
      const currentState = useVoiceStore.getState().state;
      const socket = socketRef.current;

      if (!socket?.connected) {
        setError('Not connected to backend');
        return;
      }

      if (currentState === 'idle') {
        activeCaptureRef.current = { mode, source };
        resetStreamingMessageRefs();
        setError(null);

        try {
          let screenshot = '';

          if (mode === 'coding') {
            if (!window.electronAPI) {
              throw new Error('Coding screenshot capture is only available in Electron.');
            }

            screenshot = await window.electronAPI.captureCodingScreenshot();
            if (!screenshot) {
              throw new Error('Screenshot capture failed');
            }
          }

          setState('listening');
          const audioBlob = await startRecording(source);

          const activeCapture = activeCaptureRef.current;
          if (activeCapture?.mode === mode && activeCapture?.source === source) {
            activeCaptureRef.current = null;
            if (mode === 'coding') {
              void sendCodingTaskToBackend(audioBlob, screenshot);
            } else {
              void sendAudioToBackend(audioBlob);
            }
          }
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : 'Capture failed';
          activeCaptureRef.current = null;
          setError(errorMessage);
          setState('idle');
        }
      } else if (currentState === 'listening') {
        stopRecording();
      }
    },
    [resetStreamingMessageRefs, sendAudioToBackend, sendCodingTaskToBackend, setError, setState, startRecording, stopRecording],
  );

  const handleHotkeyPress = useCallback(() => {
    void toggleCapture('voice', 'interviewer');
  }, [toggleCapture]);

  const handleMicrophoneHotkeyPress = useCallback(() => {
    void toggleCapture('voice', 'microphone');
  }, [toggleCapture]);

  const handleCodingHotkeyPress = useCallback(() => {
    void toggleCapture('coding', 'interviewer');
  }, [toggleCapture]);

  const handleMicrophoneCodingHotkeyPress = useCallback(() => {
    void toggleCapture('coding', 'microphone');
  }, [toggleCapture]);

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
      activeCaptureRef.current = null;
      setError(message);
      setState('idle');
    });

    if (!isElectron) {
      socket.on('hotkey-pressed', handleHotkeyPress);
    }

    if (isElectron && window.electronAPI && !electronListenersRegistered) {
      electronListenersRegistered = true;
      window.electronAPI.onHotkeyPressed(handleHotkeyPress);
      window.electronAPI.onMicrophoneHotkeyPressed(handleMicrophoneHotkeyPress);
      window.electronAPI.onCodingHotkeyPressed(handleCodingHotkeyPress);
      window.electronAPI.onMicrophoneCodingHotkeyPressed(handleMicrophoneCodingHotkeyPress);
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
    handleMicrophoneCodingHotkeyPress,
    handleMicrophoneHotkeyPress,
    handleToggleSettings,
    setError,
    setState,
    stopRecording,
    updateConfig,
    upsertMessage,
  ]);

  return socketRef.current;
};
