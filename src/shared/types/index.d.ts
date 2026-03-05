export type AppState = 'idle' | 'listening' | 'processing';
export interface Message {
    id: string;
    text: string;
    type: 'user' | 'assistant';
    timestamp: number;
}
export interface AppConfig {
    openaiKey?: string;
    model: string;
    hotkey: string;
    transcriptionLanguage: string;
    responseLanguage: string;
    opacity: number;
    alwaysOnTop: boolean;
}
export interface VoiceEventData {
    transcript?: string;
    response?: string;
    error?: string;
    state?: AppState;
}
export interface VoiceEvent {
    type: 'start' | 'stop' | 'transcript' | 'response' | 'error';
    data?: VoiceEventData;
}
export interface SocketResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
}
