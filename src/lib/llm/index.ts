import type { LLMProvider } from './base';
import type { ProviderName } from '../storage';
import { claudeProvider } from './claude';
import { openaiProvider, grokProvider } from './openai';
import { geminiProvider } from './gemini';

const providers: Record<ProviderName, LLMProvider> = {
  claude: claudeProvider,
  openai: openaiProvider,
  gemini: geminiProvider,
  grok: grokProvider,
};

export function getProvider(name: ProviderName): LLMProvider {
  const provider = providers[name];
  if (!provider) {
    throw new Error(`Unknown provider: ${name}`);
  }
  return provider;
}

export type { LLMProvider } from './base';
export type { ToolDefinition, ToolCall, Message } from './types';
