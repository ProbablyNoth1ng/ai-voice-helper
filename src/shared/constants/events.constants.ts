export const SOCKET_EVENTS = {
  START_LISTENING: 'start-listening',
  STOP_LISTENING: 'stop-listening',
  PROCESS_CODING_TASK: 'process-coding-task',
  UPDATE_CONFIG: 'update-config',
  TOGGLE_WINDOW: 'toggle-window',
  STATE_CHANGE: 'state-change',
  TRANSCRIPT: 'transcript',
  AI_RESPONSE: 'ai-response',
  ERROR: 'error',
  CONFIG_UPDATED: 'config-updated',
  HOTKEY_PRESSED: 'hotkey-pressed',
  CODING_HOTKEY_PRESSED: 'coding-hotkey-pressed',
  CONNECT: 'connect',
  DISCONNECT: 'disconnect'
} as const;
