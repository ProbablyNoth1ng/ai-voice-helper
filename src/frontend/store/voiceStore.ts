import { create } from 'zustand';

type AppState = 'idle' | 'listening' | 'processing';

interface Message {
  id: string;
  text: string;
  type: 'user' | 'assistant';
  timestamp: number;
}

interface AppConfig {
  model: string;
  hotkey: string;
  opacity: number;
  alwaysOnTop: boolean;
}

interface VoiceStore {
  state: AppState;
  messages: Message[];
  config: AppConfig;
  showSettings: boolean;
  error: string | null;
  
  setState: (state: AppState) => void;
  addMessage: (message: Message) => void;
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
    hotkey: 'Ctrl+Shift+Space',
    opacity: 0.6,
    alwaysOnTop: true
  },
  showSettings: false,
  error: null,

  setState: (state) => set({ state }),
  
  addMessage: (message) => 
    set((s) => ({ messages: [...s.messages, message] })),
  
  clearMessages: () => set({ messages: [] }),
  
  updateConfig: (newConfig) =>
    set((s) => ({ config: { ...s.config, ...newConfig } })),
  
  setShowSettings: (show) => set({ showSettings: show }),
  
  setError: (error) => set({ error })
}));