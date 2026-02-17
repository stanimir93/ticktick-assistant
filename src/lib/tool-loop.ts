import type { LLMProvider, LLMParsedResponse } from './llm/base';
import type { Message, ToolDefinition, ToolCall } from './llm/types';
import type { ApiVersion } from './api-version';
import { executeTool } from './tools-registry';

export interface PendingConfirmation {
  toolCall: ToolCall;
  toolDefinition: ToolDefinition;
}

export interface ToolLoopCallbacks {
  onToolCall?: (toolCall: ToolCall) => void;
  onToolResult?: (toolCallId: string, name: string, result: string) => void;
  onText?: (text: string) => void;
  onConfirmationNeeded?: (pending: PendingConfirmation) => Promise<boolean>;
}

export async function runToolLoop(
  provider: LLMProvider,
  messages: Message[],
  tools: ToolDefinition[],
  model: string,
  apiKey: string,
  ticktickToken: string,
  callbacks?: ToolLoopCallbacks,
  signal?: AbortSignal,
  apiVersion: ApiVersion = 'v1',
  sessionToken?: string
): Promise<{ text: string; messages: Message[] }> {
  const conversationMessages = [...messages];
  const maxIterations = 10;

  for (let i = 0; i < maxIterations; i++) {
    if (signal?.aborted) {
      return { text: 'Request stopped.', messages: conversationMessages };
    }

    const request = provider.buildRequest(
      conversationMessages,
      tools,
      model,
      apiKey
    );

    const response = await fetch(request.url, {
      method: 'POST',
      headers: request.headers,
      body: JSON.stringify(request.body),
      signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`LLM API error (${response.status}): ${errorText}`);
    }

    const json = await response.json();
    const parsed: LLMParsedResponse = provider.parseResponse(json);

    // Add assistant message to conversation
    if (parsed.rawAssistantMessage) {
      conversationMessages.push(parsed.rawAssistantMessage as Message);
    }

    // If no tool calls, we're done
    if (!parsed.toolCalls?.length) {
      const finalText = parsed.text ?? '';
      callbacks?.onText?.(finalText);
      return { text: finalText, messages: conversationMessages };
    }

    // Execute tool calls
    for (const toolCall of parsed.toolCalls) {
      const toolDef = tools.find((t) => t.name === toolCall.name);

      // Check if this tool requires confirmation
      if (toolDef?.requiresConfirmation && callbacks?.onConfirmationNeeded) {
        const confirmed = await callbacks.onConfirmationNeeded({
          toolCall,
          toolDefinition: toolDef,
        });

        if (!confirmed) {
          // User cancelled — send cancellation result back to LLM
          const cancelResult = JSON.stringify({
            cancelled: true,
            message: 'User cancelled this action',
          });
          callbacks?.onToolResult?.(toolCall.id, toolCall.name, cancelResult);
          const resultId =
            provider.name === 'gemini' ? toolCall.name : toolCall.id;
          conversationMessages.push(
            provider.formatToolResult(resultId, cancelResult) as Message
          );
          continue;
        }
      }

      callbacks?.onToolCall?.(toolCall);

      const result = await executeTool(
        apiVersion,
        toolCall.name,
        toolCall.arguments,
        ticktickToken,
        sessionToken
      );

      callbacks?.onToolResult?.(toolCall.id, toolCall.name, result);

      // For Gemini, we need to pass the tool name as the ID for formatToolResult
      const resultId =
        provider.name === 'gemini' ? toolCall.name : toolCall.id;
      const toolResultMessage = provider.formatToolResult(resultId, result);
      conversationMessages.push(toolResultMessage as Message);
    }
  }

  return {
    text: 'Reached maximum tool call iterations.',
    messages: conversationMessages,
  };
}
