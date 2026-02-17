import type { Message, ToolDefinition, ToolCall } from './types';

export interface LLMRequest {
  url: string;
  headers: Record<string, string>;
  body: unknown;
}

export interface LLMParsedResponse {
  text?: string;
  toolCalls?: ToolCall[];
  rawAssistantMessage?: unknown;
}

export interface LLMProvider {
  name: string;
  formatTools(tools: ToolDefinition[]): unknown;
  buildRequest(
    messages: Message[],
    tools: ToolDefinition[],
    model: string,
    apiKey: string
  ): LLMRequest;
  parseResponse(response: unknown): LLMParsedResponse;
  formatToolResult(toolCallId: string, result: string): unknown;
  models: { default: string; options: string[] };
}
