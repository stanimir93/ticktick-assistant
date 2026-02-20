import type { LLMProvider, LLMRequest, LLMParsedResponse } from './base';
import type { Message, ToolDefinition, ToolCall } from './types';

const PROXY_URL = import.meta.env.VITE_PROXY_URL || '';

export const claudeProvider: LLMProvider = {
  name: 'claude',

  models: {
    default: 'claude-sonnet-4-6',
    options: [
      'claude-sonnet-4-6',
      'claude-haiku-4-5-20251001',
      'claude-opus-4-6',
    ],
  },

  formatTools(tools: ToolDefinition[]) {
    return tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters,
    }));
  },

  buildRequest(
    messages: Message[],
    tools: ToolDefinition[],
    model: string,
    apiKey: string
  ): LLMRequest {
    const systemMessage = messages.find((m) => m.role === 'system');
    const nonSystemMessages = messages.filter((m) => m.role !== 'system');

    return {
      url: `${PROXY_URL}/api/llm/anthropic/v1/messages`,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: {
        model,
        max_tokens: 4096,
        ...(systemMessage ? { system: systemMessage.content as string } : {}),
        messages: nonSystemMessages,
        tools: this.formatTools(tools),
      },
    };
  },

  parseResponse(response: unknown): LLMParsedResponse {
    const res = response as {
      content: Array<{
        type: string;
        text?: string;
        id?: string;
        name?: string;
        input?: Record<string, unknown>;
      }>;
    };

    let text = '';
    const toolCalls: ToolCall[] = [];

    for (const block of res.content) {
      if (block.type === 'text' && block.text) {
        text += block.text;
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id!,
          name: block.name!,
          arguments: block.input ?? {},
        });
      }
    }

    return {
      text: text || undefined,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      rawAssistantMessage: { role: 'assistant', content: res.content },
    };
  },

  formatToolResult(toolCallId: string, result: string) {
    return {
      role: 'user',
      content: [
        {
          type: 'tool_result',
          tool_use_id: toolCallId,
          content: result,
        },
      ],
    };
  },
};
