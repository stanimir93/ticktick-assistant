import type { LLMProvider, LLMRequest, LLMParsedResponse } from './base';
import type { Message, ToolDefinition, ToolCall } from './types';

const PROXY_URL = import.meta.env.VITE_PROXY_URL || '';

function createOpenAICompatibleProvider(
  name: string,
  proxyPath: string,
  models: { default: string; options: string[] }
): LLMProvider {
  return {
    name,
    models,

    formatTools(tools: ToolDefinition[]) {
      return tools.map((t) => ({
        type: 'function' as const,
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      }));
    },

    buildRequest(
      messages: Message[],
      tools: ToolDefinition[],
      model: string,
      apiKey: string
    ): LLMRequest {
      return {
        url: `${PROXY_URL}${proxyPath}/v1/chat/completions`,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: {
          model,
          messages,
          tools: this.formatTools(tools),
        },
      };
    },

    parseResponse(response: unknown): LLMParsedResponse {
      const res = response as {
        choices: Array<{
          message: {
            role: string;
            content?: string;
            tool_calls?: Array<{
              id: string;
              function: {
                name: string;
                arguments: string;
              };
            }>;
          };
        }>;
      };

      const message = res.choices[0]?.message;
      if (!message) return {};

      const toolCalls: ToolCall[] = (message.tool_calls ?? []).map((tc) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: JSON.parse(tc.function.arguments),
      }));

      return {
        text: message.content || undefined,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        rawAssistantMessage: { ...message, role: 'assistant' as const },
      };
    },

    formatToolResult(toolCallId: string, result: string) {
      return {
        role: 'tool',
        tool_call_id: toolCallId,
        content: result,
      };
    },
  };
}

export const openaiProvider = createOpenAICompatibleProvider(
  'openai',
  '/api/llm/openai',
  {
    default: 'gpt-4.1',
    options: ['gpt-4.1', 'gpt-4.1-mini', 'o3', 'o4-mini'],
  }
);

export const grokProvider = createOpenAICompatibleProvider(
  'grok',
  '/api/llm/grok',
  {
    default: 'grok-4-fast-non-reasoning',
    options: ['grok-4-fast-non-reasoning', 'grok-4-1-fast-non-reasoning', 'grok-3'],
  }
);
