import { create } from 'zustand';

type AppState = 'idle' | 'listening' | 'processing';
type MessageType = 'user' | 'assistant' | 'system';

interface Message {
  id: string;
  text: string;
  type: MessageType;
  timestamp: number;
}

interface AppConfig {
  model: string;
  hotkey: string;
  microphoneHotkey?: string;
  codingHotkey?: string;
  microphoneCodingHotkey?: string;
  opacity: number;
  alwaysOnTop: boolean;
  transcriptionLanguage?: string;
  responseLanguage?: string;
  aiProvider?: string;
  aiModel?: string;
  microphoneDeviceId?: string;
  microphoneDeviceLabel?: string;
}

interface VoiceStore {
  state: AppState;
  messages: Message[];
  config: AppConfig;
  showSettings: boolean;
  error: string | null;

  setState: (state: AppState) => void;
  addMessage: (message: Message) => void;
  upsertMessage: (message: Message) => void;
  appendToMessage: (id: string, text: string, type: MessageType) => void;
  clearMessages: () => void;
  updateConfig: (config: Partial<AppConfig>) => void;
  setShowSettings: (show: boolean) => void;
  setError: (error: string | null) => void;
}

export const useVoiceStore = create<VoiceStore>((set) => ({
  state: 'idle',
  messages: [],
  config: {
    model: 'gpt-4o-mini',
    hotkey: 'Ctrl+Shift+Q',
    microphoneHotkey: 'Ctrl+Shift+Alt+Q',
    codingHotkey: 'Ctrl+Shift+`',
    microphoneCodingHotkey: 'Ctrl+Shift+Alt+`',
    opacity: 0.9,
    alwaysOnTop: true,
    transcriptionLanguage: 'en',
    responseLanguage: 'en',
    aiProvider: 'openai',
    aiModel: 'gpt-4o-mini',
  },
  showSettings: false,
  error: null,

  setState: (state) => {
    console.log('Store setState ->', state);
    set({ state });
  },

  addMessage: (message) => set((s) => ({ messages: [...s.messages, message] })),

  upsertMessage: (message) =>
    set((s) => {
      const existingIndex = s.messages.findIndex((item) => item.id === message.id);
      if (existingIndex === -1) {
        return { messages: [...s.messages, message] };
      }

      const messages = [...s.messages];
      messages[existingIndex] = { ...messages[existingIndex], ...message };
      return { messages };
    }),

  appendToMessage: (id, text, type) =>
    set((s) => {
      const existingIndex = s.messages.findIndex((item) => item.id === id);
      if (existingIndex === -1) {
        return {
          messages: [
            ...s.messages,
            {
              id,
              text,
              type,
              timestamp: Date.now(),
            },
          ],
        };
      }

      const messages = [...s.messages];
      messages[existingIndex] = {
        ...messages[existingIndex],
        text: messages[existingIndex].text + text,
      };
      return { messages };
    }),

  clearMessages: () => set({ messages: [] }),

  updateConfig: (newConfig) => {
    console.log('Store updateConfig ->', newConfig);
    set((s) => ({
      config: { ...s.config, ...newConfig },
    }));
  },

  setShowSettings: (show) => {
    console.log('Store setShowSettings ->', show);
    set({ showSettings: show });
  },

  setError: (error) => set({ error }),
}));
