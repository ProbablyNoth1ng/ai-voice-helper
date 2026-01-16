export const SOCKET_EVENTS = {
  START_LISTENING: 'start-listening',
  STOP_LISTENING: 'stop-listening',
  UPDATE_CONFIG: 'update-config',
  TOGGLE_WINDOW: 'toggle-window',
  STATE_CHANGE: 'state-change',
  TRANSCRIPT: 'transcript',
  AI_RESPONSE: 'ai-response',
  ERROR: 'error',
  CONFIG_UPDATED: 'config-updated',
  HOTKEY_PRESSED: 'hotkey-pressed',
  CONNECT: 'connect',
  DISCONNECT: 'disconnect'
} as const;
