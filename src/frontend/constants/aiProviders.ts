export interface ModelOption {
  label: string;
  value: string;
}

export interface AIProviderOption {
  id: string;
  name: string;
  icon: string;
  models: ModelOption[];
  keyLabel: string;
  keyPlaceholder: string;
}

export const AI_PROVIDERS: AIProviderOption[] = [
  {
    id: 'openai',
    name: 'OpenAI (ChatGPT)',
    icon: '🤖',
    models: [
      { label: 'GPT-5 Mini', value: 'gpt-5-mini-2025-08-07' },
      { label: 'GPT-5.4 Mini', value: 'gpt-5.4-mini-2026-03-17' },
      { label: 'GPT-5.5', value: 'gpt-5.5-2026-04-23' },
      { label: 'GPT-4o', value: 'gpt-4o' },
      { label: 'GPT-4o Mini', value: 'gpt-4o-mini' },
      { label: 'GPT-4 Turbo', value: 'gpt-4-turbo' },
    ],
    keyLabel: 'OpenAI API Key',
    keyPlaceholder: 'sk-...',
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    icon: '✨',
    models: [
      { label: 'gemini-2.0-flash-exp', value: 'gemini-2.0-flash-exp' },
      { label: 'gemini-1.5-flash', value: 'gemini-1.5-flash' },
      { label: 'gemini-1.5-pro', value: 'gemini-1.5-pro' },
    ],
    keyLabel: 'Gemini API Key',
    keyPlaceholder: 'AIza...',
  },
  {
    id: 'claude',
    name: 'Anthropic Claude',
    icon: '🧠',
    models: [
      { label: 'claude-sonnet-4-20250514', value: 'claude-sonnet-4-20250514' },
      { label: 'claude-3-5-sonnet-20241022', value: 'claude-3-5-sonnet-20241022' },
      { label: 'claude-3-haiku-20240307', value: 'claude-3-haiku-20240307' },
      { label: 'claude-3-opus-20240229', value: 'claude-3-opus-20240229' },
    ],
    keyLabel: 'Claude API Key',
    keyPlaceholder: 'sk-ant-...',
  },
];

export function getProviderById(providerId: string) {
  return AI_PROVIDERS.find((provider) => provider.id === providerId);
}

export function getModelLabel(providerId: string, modelValue: string) {
  const provider = getProviderById(providerId);
  return provider?.models.find((model) => model.value === modelValue)?.label ?? modelValue;
}
