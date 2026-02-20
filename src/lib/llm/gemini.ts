import type { LLMProvider, LLMRequest, LLMParsedResponse } from './base';
import type { Message, ToolDefinition, ToolCall } from './types';

const PROXY_URL = import.meta.env.VITE_PROXY_URL || '';

/** Convert JSON Schema nullable arrays (type: ['string', 'null']) to Gemini format (type: 'string', nullable: true) */
function convertSchema(schema: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(schema)) {
    if (key === 'type' && Array.isArray(value)) {
      const types = value.filter((t) => t !== 'null');
      result.type = types.length === 1 ? types[0] : types;
      if (value.includes('null')) {
        result.nullable = true;
      }
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = convertSchema(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result;
}

export const geminiProvider: LLMProvider = {
  name: 'gemini',

  models: {
    default: 'gemini-2.5-flash',
    options: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.5-flash-lite', 'gemini-3-flash-preview', 'gemini-3-pro-preview', 'gemini-3.1-pro-preview'],
  },

  formatTools(tools: ToolDefinition[]) {
    return [
      {
        function_declarations: tools.map((t) => ({
          name: t.name,
          description: t.description,
          parameters: convertSchema(t.parameters),
        })),
      },
    ];
  },

  buildRequest(
    messages: Message[],
    tools: ToolDefinition[],
    model: string,
    apiKey: string
  ): LLMRequest {
    const systemMessage = messages.find((m) => m.role === 'system');
    const nonSystemMessages = messages.filter((m) => m.role !== 'system');

    const contents = nonSystemMessages.map((m) => {
      if (m.role === 'user' && typeof m.content === 'string') {
        return { role: 'user', parts: [{ text: m.content }] };
      }
      if (m.role === 'assistant' && typeof m.content === 'string') {
        return { role: 'model', parts: [{ text: m.content }] };
      }
      // Already formatted (tool results, function calls)
      return m.content;
    });

    return {
      url: `${PROXY_URL}/api/llm/gemini/v1beta/models/${model}:generateContent`,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: {
        contents,
        tools: this.formatTools(tools),
        ...(systemMessage
          ? { system_instruction: { parts: [{ text: systemMessage.content as string }] } }
          : {}),
      },
    };
  },

  parseResponse(response: unknown): LLMParsedResponse {
    const res = response as {
      candidates: Array<{
        content: {
          role: string;
          parts: Array<{
            text?: string;
            functionCall?: { name: string; args: Record<string, unknown> };
          }>;
        };
      }>;
    };

    const parts = res.candidates?.[0]?.content?.parts ?? [];
    let text = '';
    const toolCalls: ToolCall[] = [];

    for (const part of parts) {
      if (part.text) {
        text += part.text;
      }
      if (part.functionCall) {
        toolCalls.push({
          id: crypto.randomUUID(),
          name: part.functionCall.name,
          arguments: part.functionCall.args ?? {},
        });
      }
    }

    return {
      text: text || undefined,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      rawAssistantMessage: {
        role: 'assistant',
        content: res.candidates?.[0]?.content,
      },
    };
  },

  formatToolResult(toolCallId: string, result: string) {
    void toolCallId;
    return {
      role: 'user',
      content: {
        role: 'user',
        parts: [
          {
            functionResponse: {
              name: toolCallId,
              response: { result: JSON.parse(result) },
            },
          },
        ],
      },
    };
  },
};
