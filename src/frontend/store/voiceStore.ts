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
  transcriptionLanguage?: string;
  responseLanguage?: string;
  aiProvider?: string;  
  aiModel?: string;  
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

export const useVoiceStore = create<VoiceStore>((set, get) => ({
  state: 'idle',
  messages: [],
  config: {
    model: 'gpt-4o-mini',
    hotkey: 'Ctrl+Shift+Q',
    opacity: 0.9,
    alwaysOnTop: true,
    transcriptionLanguage: 'en',
    responseLanguage: 'en',
    aiProvider: 'openai',
    aiModel: 'gpt-4o-mini' 
  },
  showSettings: false,
  error: null,

  setState: (state) => {
    console.log('📦 Store: setState ->', state);
    set({ state });
  },
  
  addMessage: (message) => 
    set((s) => ({ messages: [...s.messages, message] })),
  
  clearMessages: () => set({ messages: [] }),
  
  updateConfig: (newConfig) => {
      console.log('📦 Store: updateConfig ->', newConfig);
      set((s) => ({ 
        config: { ...s.config, ...newConfig } 
      }));
    },

  setShowSettings: (show) => {
    console.log('📦 Store: setShowSettings ->', show);
    set({ showSettings: show });
  },
  
  setError: (error) => set({ error })
}));