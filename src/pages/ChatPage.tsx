import { useState, useReducer, useRef, useEffect, useCallback } from 'react';
import { useLocalStorage } from '@uidotdev/usehooks';
import type { ProvidersMap, ProviderName } from '@/lib/storage';
import { getConfiguredProviderNames } from '@/lib/storage';
import { getProvider } from '@/lib/llm';
import type { Message } from '@/lib/llm/types';
import { toolDefinitions } from '@/lib/tools';
import { runToolLoop } from '@/lib/tool-loop';
import { db, type StoredMessage } from '@/lib/db';
import ChatMessage from '@/components/ChatMessage';
import type {
  ChatMessageData,
  ToolCallDisplay,
  ConfirmationDisplay,
} from '@/components/ChatMessage';
import ChatInput from '@/components/ChatInput';
import ProviderSwitcher from '@/components/ProviderSwitcher';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';


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
    }
  | { type: 'load_messages'; messages: ChatMessageData[] };

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
    case 'load_messages':
      return action.messages;
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
3. Then use update/complete/delete tools to make changes as requested

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
- delete_task requires user confirmation
- Always include the task title in the tool call so the confirmation card can display it
- If the user cancels, acknowledge it and do not retry`;
}

/** Strip the non-serializable \`resolve\` function before persisting */
function toStoredMessages(messages: ChatMessageData[]): StoredMessage[] {
  return messages.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    provider: m.provider,
    model: m.model,
    toolCalls: m.toolCalls,
    confirmations: m.confirmations?.map(({ resolve: _, ...rest }) => rest),
  }));
}

/** Derive a conversation title from the first user message */
function deriveTitle(messages: ChatMessageData[]): string {
  const firstUser = messages.find((m) => m.role === 'user');
  if (!firstUser) return 'New conversation';
  const text = firstUser.content.slice(0, 60);
  return text.length < firstUser.content.length ? text + '...' : text;
}

interface ChatPageProps {
  conversationId: string | null;
}

export default function ChatPage({ conversationId }: ChatPageProps) {
  const [messages, dispatch] = useReducer(chatReducer, []);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Track which conversation is currently active (ref avoids re-renders)
  const activeIdRef = useRef<string | null>(null);

  const [providers, setProviders] = useLocalStorage<ProvidersMap>('llm-providers', {});
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

  const handleModelChange = useCallback(
    (model: string) => {
      if (!activeProvider) return;
      const name = activeProvider as ProviderName;
      const prev = providers[name];
      if (!prev) return;
      setProviders({ ...providers, [name]: { ...prev, model } });
    },
    [activeProvider, providers, setProviders]
  );

  const configuredProviders = getConfiguredProviderNames(providers);
  const isReady =
    !!ticktickToken && !!activeProvider && configuredProviders.length > 0;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load conversation when the URL-driven ID changes
  useEffect(() => {
    if (conversationId === activeIdRef.current) return;
    activeIdRef.current = conversationId;

    if (!conversationId) {
      dispatch({ type: 'load_messages', messages: [] });
      conversationRef.current = [
        { role: 'system', content: buildSystemPrompt() },
      ];
      return;
    }

    db.conversations.get(conversationId).then((conv) => {
      if (!conv || activeIdRef.current !== conversationId) return;
      const restored: ChatMessageData[] = conv.messages.map((m) => ({
        ...m,
        confirmations: m.confirmations?.map((c) => ({
          ...c,
          resolve: undefined,
        })),
      }));
      dispatch({ type: 'load_messages', messages: restored });

      const llmMessages: Message[] = [
        { role: 'system', content: buildSystemPrompt() },
      ];
      for (const m of conv.messages) {
        if (m.role === 'user') {
          llmMessages.push({ role: 'user', content: m.content });
        } else if (m.role === 'assistant' && m.content) {
          llmMessages.push({ role: 'assistant', content: m.content });
        }
      }
      conversationRef.current = llmMessages;
    });
  }, [conversationId]);

  // Persist messages to IndexedDB whenever they change
  useEffect(() => {
    const id = activeIdRef.current;
    if (!id || messages.length === 0) return;

    const now = Date.now();
    db.conversations
      .update(id, {
        messages: toStoredMessages(messages),
        title: deriveTitle(messages),
        updatedAt: now,
      })
      .catch(() => {
        db.conversations.put({
          id: id,
          title: deriveTitle(messages),
          messages: toStoredMessages(messages),
          createdAt: now,
          updatedAt: now,
        });
      });
  }, [messages]);

  const handleSend = useCallback(
    async (text: string) => {
      if (!isReady || !activeProvider) return;

      // Auto-create conversation if none active
      let currentConvId = activeIdRef.current;
      if (!currentConvId) {
        currentConvId = crypto.randomUUID();
        activeIdRef.current = currentConvId;
        const now = Date.now();
        await db.conversations.put({
          id: currentConvId,
          title: 'New conversation',
          messages: [],
          createdAt: now,
          updatedAt: now,
        });
        // Update URL to reflect the new conversation
        window.location.hash = `#/chat/${currentConvId}`;
      }

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
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <h1 className="text-sm font-semibold">TickTick Assistant</h1>
        <div className="ml-auto">
          <ProviderSwitcher
            providers={providers}
            activeProvider={activeProvider}
            onSwitch={setActiveProvider}
            onModelChange={handleModelChange}
          />
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
              <a
                href="#/settings"
                className="mt-2 inline-flex h-8 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Go to Settings
              </a>
            </div>
          )}

          {messages.length === 0 && isReady && (
            <div className="py-12 text-center text-muted-foreground">
              <p className="text-lg">Start a new conversation</p>
              <p className="mt-1 text-sm">
                Ask me to manage your TickTick tasks
              </p>
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
