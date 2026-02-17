export interface ProviderConfig {
  apiKey: string;
  model: string;
}

export type ProviderName = 'claude' | 'openai' | 'gemini' | 'grok';

export type ProvidersMap = Partial<Record<ProviderName, ProviderConfig>>;

export function getConfiguredProviderNames(providers: ProvidersMap): ProviderName[] {
  return (Object.keys(providers) as ProviderName[]).filter(
    (name) => providers[name]?.apiKey
  );
}
