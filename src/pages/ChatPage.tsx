import { useState, useReducer, useRef, useEffect, useCallback } from 'react';
import { useLocalStorage } from '@uidotdev/usehooks';
import type { ProvidersMap, ProviderName } from '@/lib/storage';
import { getConfiguredProviderNames } from '@/lib/storage';
import { getProvider } from '@/lib/llm';
import type { Message } from '@/lib/llm/types';
import { toolDefinitions } from '@/lib/tools';
import { runToolLoop } from '@/lib/tool-loop';
import ChatMessage from '@/components/ChatMessage';
import type {
  ChatMessageData,
  ToolCallDisplay,
  ConfirmationDisplay,
} from '@/components/ChatMessage';
import ChatInput from '@/components/ChatInput';
import ProviderSwitcher from '@/components/ProviderSwitcher';
import { Button } from '@/components/ui/button';

interface ChatPageProps {
  onNavigateSettings: () => void;
}

type ChatAction =
  | { type: 'add_message'; message: ChatMessageData }
  | { type: 'update_message'; id: string; updates: Partial<ChatMessageData> }
  | { type: 'add_tool_call'; messageId: string; toolCall: ToolCallDisplay }
  | {
      type: 'update_tool_result';
      messageId: string;
      toolCallId: string;
      result: string;
    }
  | {
      type: 'add_confirmation';
      messageId: string;
      confirmation: ConfirmationDisplay;
    }
  | {
      type: 'resolve_confirmation';
      messageId: string;
      confirmationId: string;
      status: 'confirmed' | 'cancelled';
    };

function chatReducer(
  state: ChatMessageData[],
  action: ChatAction
): ChatMessageData[] {
  switch (action.type) {
    case 'add_message':
      return [...state, action.message];
    case 'update_message':
      return state.map((m) =>
        m.id === action.id ? { ...m, ...action.updates } : m
      );
    case 'add_tool_call':
      return state.map((m) =>
        m.id === action.messageId
          ? { ...m, toolCalls: [...(m.toolCalls ?? []), action.toolCall] }
          : m
      );
    case 'update_tool_result':
      return state.map((m) =>
        m.id === action.messageId
          ? {
              ...m,
              toolCalls: m.toolCalls?.map((tc) =>
                tc.id === action.toolCallId
                  ? { ...tc, result: action.result }
                  : tc
              ),
            }
          : m
      );
    case 'add_confirmation':
      return state.map((m) =>
        m.id === action.messageId
          ? {
              ...m,
              confirmations: [
                ...(m.confirmations ?? []),
                action.confirmation,
              ],
            }
          : m
      );
    case 'resolve_confirmation':
      return state.map((m) =>
        m.id === action.messageId
          ? {
              ...m,
              confirmations: m.confirmations?.map((c) =>
                c.id === action.confirmationId
                  ? { ...c, status: action.status, resolve: undefined }
                  : c
              ),
            }
          : m
      );
    default:
      return state;
  }
}

function buildSystemPrompt(): string {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return `You are a helpful TickTick task management assistant. You help users organize, manage, and update their tasks and projects in TickTick.

When the user asks about their tasks or projects, use the available tools to fetch data from TickTick. When they ask to modify tasks, use the appropriate tools to make changes.

Always be concise and clear in your responses. When listing tasks, format them in a readable way. When making changes, confirm what you did.

Important workflow:
1. First use list_projects to understand what projects exist
2. Use get_project_tasks to see tasks in a specific project
3. Use get_project_sections to understand the sections/columns in a project
4. Then use update/move/complete/delete tools to make changes as requested

Date handling:
- Current date and time: ${new Date().toISOString()} (${tz})
- When setting due dates, convert natural language to ISO 8601 format (e.g. "2026-02-20T16:00:00.000+0000")
- Use the timezone "${tz}" unless the user specifies otherwise
- For all-day dates (no specific time), set isAllDay to true
- To remove a due date, set dueDate to null

Flagging:
- Flag tasks by adding the "flagged" tag, unflag by removing it
- Use get_flagged_tasks to list all flagged tasks across projects

Destructive actions:
- delete_task, batch_delete_tasks, and move_task_to_project require user confirmation
- Always include the task title and project name in the tool call so the confirmation card can display them
- If the user cancels, acknowledge it and do not retry`;
}

export default function ChatPage({ onNavigateSettings }: ChatPageProps) {
  const [messages, dispatch] = useReducer(chatReducer, []);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [providers] = useLocalStorage<ProvidersMap>('llm-providers', {});
  const [activeProvider, setActiveProvider] = useLocalStorage<string | null>(
    'active-provider',
    null
  );
  const [ticktickToken] = useLocalStorage<string | null>(
    'ticktick-token',
    null
  );

  const conversationRef = useRef<Message[]>([
    { role: 'system', content: buildSystemPrompt() },
  ]);

  const configuredProviders = getConfiguredProviderNames(providers);
  const isReady =
    !!ticktickToken && !!activeProvider && configuredProviders.length > 0;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = useCallback(
    async (text: string) => {
      if (!isReady || !activeProvider) return;

      const providerName = activeProvider as ProviderName;
      const providerConfig = providers[providerName];
      if (!providerConfig) return;

      const provider = getProvider(providerName);

      const userMsgId = crypto.randomUUID();
      dispatch({
        type: 'add_message',
        message: { id: userMsgId, role: 'user', content: text },
      });

      conversationRef.current.push({ role: 'user', content: text });

      const assistantMsgId = crypto.randomUUID();
      dispatch({
        type: 'add_message',
        message: {
          id: assistantMsgId,
          role: 'assistant',
          content: '',
          provider: providerName,
          model: providerConfig.model,
        },
      });

      setLoading(true);

      try {
        const { text: responseText, messages: updatedMessages } =
          await runToolLoop(
            provider,
            conversationRef.current,
            toolDefinitions,
            providerConfig.model,
            providerConfig.apiKey,
            ticktickToken!,
            {
              onToolCall(toolCall) {
                dispatch({
                  type: 'add_tool_call',
                  messageId: assistantMsgId,
                  toolCall: {
                    id: toolCall.id,
                    name: toolCall.name,
                    args: toolCall.arguments,
                  },
                });
              },
              onToolResult(toolCallId, _name, result) {
                dispatch({
                  type: 'update_tool_result',
                  messageId: assistantMsgId,
                  toolCallId,
                  result,
                });
              },
              onConfirmationNeeded(pending) {
                return new Promise<boolean>((resolve) => {
                  const wrappedResolve = (confirmed: boolean) => {
                    dispatch({
                      type: 'resolve_confirmation',
                      messageId: assistantMsgId,
                      confirmationId: pending.toolCall.id,
                      status: confirmed ? 'confirmed' : 'cancelled',
                    });
                    resolve(confirmed);
                  };

                  dispatch({
                    type: 'add_confirmation',
                    messageId: assistantMsgId,
                    confirmation: {
                      id: pending.toolCall.id,
                      toolName: pending.toolCall.name,
                      args: pending.toolCall.arguments,
                      status: 'pending',
                      resolve: wrappedResolve,
                    },
                  });
                });
              },
            }
          );

        conversationRef.current = updatedMessages;

        dispatch({
          type: 'update_message',
          id: assistantMsgId,
          updates: { content: responseText },
        });
      } catch (err) {
        dispatch({
          type: 'update_message',
          id: assistantMsgId,
          updates: {
            content: `Error: ${err instanceof Error ? err.message : 'Something went wrong'}`,
          },
        });
      } finally {
        setLoading(false);
      }
    },
    [isReady, activeProvider, providers, ticktickToken]
  );

  return (
    <div className="flex h-screen flex-col">
      {/* Header */}
      <header className="flex items-center justify-between border-b bg-background px-4 py-3">
        <h1 className="text-lg font-semibold">TickTick Assistant</h1>
        <div className="flex items-center gap-3">
          <ProviderSwitcher
            providers={providers}
            activeProvider={activeProvider}
            onSwitch={setActiveProvider}
          />
          <Button onClick={onNavigateSettings} variant="outline" size="sm">
            Settings
          </Button>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl space-y-4 p-4">
          {!isReady && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              {!ticktickToken && (
                <p>Connect your TickTick account in Settings.</p>
              )}
              {configuredProviders.length === 0 && (
                <p>Configure at least one LLM provider in Settings.</p>
              )}
              <Button
                onClick={onNavigateSettings}
                size="sm"
                className="mt-2"
              >
                Go to Settings
              </Button>
            </div>
          )}

          {messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <ChatInput onSend={handleSend} disabled={loading || !isReady} />
    </div>
  );
}
