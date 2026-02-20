import { useState, useReducer, useRef, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useLocalStorage } from '@uidotdev/usehooks';
import type { ProvidersMap, ProviderName } from '@/lib/storage';
import { getConfiguredProviderNames } from '@/lib/storage';
import { getProvider } from '@/lib/llm';
import type { Message } from '@/lib/llm/types';
import { type ApiVersion, API_VERSION_KEY, DEFAULT_API_VERSION, V2_SESSION_KEY } from '@/lib/api-version';
import { getToolDefinitions } from '@/lib/tools-registry';
import { runToolLoop } from '@/lib/tool-loop';
import { buildSystemPrompt } from '@/lib/system-prompt';
import { Badge } from '@/components/ui/badge';
import { db, type StoredMessage } from '@/lib/db';
import { ErrorBoundary } from 'react-error-boundary';
import ErrorFallback from '@/components/ErrorFallback';
import ChatMessage from '@/components/ChatMessage';
import type {
  ChatMessageData,
  ToolCallDisplay,
  ConfirmationDisplay,
} from '@/components/ChatMessage';
import ChatInput from '@/components/ChatInput';
import ProviderSwitcher from '@/components/ProviderSwitcher';
import ThemeToggle from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { SquarePen } from 'lucide-react';


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

export default function ChatPage() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const navigate = useNavigate();
  const [messages, dispatch] = useReducer(chatReducer, []);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Track which conversation is currently active (ref avoids re-renders)
  const activeIdRef = useRef<string | undefined>(undefined);

  const [providers, setProviders] = useLocalStorage<ProvidersMap>('llm-providers', {});
  const [activeProvider, setActiveProvider] = useLocalStorage<string | null>(
    'active-provider',
    null
  );
  const [ticktickToken] = useLocalStorage<string | null>(
    'ticktick-token',
    null
  );
  const [apiVersion] = useLocalStorage<ApiVersion>(API_VERSION_KEY, DEFAULT_API_VERSION);
  const [v2Session] = useLocalStorage<string | null>(V2_SESSION_KEY, null);

  const conversationRef = useRef<Message[]>([
    { role: 'system', content: buildSystemPrompt(apiVersion) },
  ]);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleProviderModelChange = useCallback(
    (provider: ProviderName, model: string) => {
      setActiveProvider(provider);
      const prev = providers[provider];
      if (!prev) return;
      setProviders({ ...providers, [provider]: { ...prev, model } });
    },
    [providers, setProviders, setActiveProvider]
  );

  const configuredProviders = getConfiguredProviderNames(providers);
  const v2Ready = apiVersion === 'v1' || !!v2Session;
  const isReady =
    !!ticktickToken && !!activeProvider && configuredProviders.length > 0 && v2Ready;
  const tools = getToolDefinitions(apiVersion);

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
        { role: 'system', content: buildSystemPrompt(apiVersion) },
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

      // Mark interrupted assistant messages (empty content from aborted requests)
      const last = restored[restored.length - 1];
      if (last?.role === 'assistant' && !last.content) {
        last.content = '*Response interrupted — send a new message to continue.*';
      }

      dispatch({ type: 'load_messages', messages: restored });

      const llmMessages: Message[] = [
        { role: 'system', content: buildSystemPrompt(apiVersion) },
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
        navigate(`/chat/${currentConvId}`, { replace: true });
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
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        const { text: responseText, messages: updatedMessages } =
          await runToolLoop(
            provider,
            conversationRef.current,
            tools,
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
            },
            abortController.signal,
            apiVersion,
            v2Session ?? undefined
          );

        conversationRef.current = updatedMessages;

        dispatch({
          type: 'update_message',
          id: assistantMsgId,
          updates: { content: responseText },
        });
      } catch (err) {
        if (abortController.signal.aborted) {
          dispatch({
            type: 'update_message',
            id: assistantMsgId,
            updates: { content: 'Request stopped.' },
          });
        } else {
          dispatch({
            type: 'update_message',
            id: assistantMsgId,
            updates: {
              content: `Error: ${err instanceof Error ? err.message : 'Something went wrong'}`,
            },
          });
        }
      } finally {
        abortControllerRef.current = null;
        setLoading(false);
      }
    },
    [isReady, activeProvider, providers, ticktickToken, navigate, tools, apiVersion, v2Session]
  );

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-2 border-b bg-background px-4">
        <SidebarTrigger className="-ml-1 !size-9 md:!size-7" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        {/* Mobile: New Chat button replaces title */}
        <Button variant="ghost" size="icon" className="md:hidden h-9 w-9" disabled={!conversationId} asChild={!!conversationId}>
          {conversationId ? (
            <Link to="/">
              <SquarePen className="h-5 w-5" />
            </Link>
          ) : (
            <SquarePen className="h-5 w-5" />
          )}
        </Button>
        {/* Desktop: Show title */}
        <h1 className="hidden md:flex text-sm font-semibold items-center gap-1.5">
          <Link to="/" className="hover:opacity-80">
            TickTick Assistant
          </Link>
          {apiVersion === 'v2' && (
            <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-orange-400 text-orange-500">
              v2 BETA
            </Badge>
          )}
        </h1>
        <div className="ml-auto flex items-center gap-2">
          {/* Desktop: New Chat button */}
          <Button variant="ghost" size="icon" className="hidden md:inline-flex h-8 w-8" disabled={!conversationId} asChild={!!conversationId}>
            {conversationId ? (
              <Link to="/">
                <SquarePen className="h-4 w-4" />
              </Link>
            ) : (
              <SquarePen className="h-4 w-4" />
            )}
          </Button>
          <ProviderSwitcher
            providers={providers}
            activeProvider={activeProvider}
            onChange={handleProviderModelChange}
            disabled={loading}
          />
          <ThemeToggle />
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl space-y-4 p-4">
          {!isReady && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
              {!ticktickToken && (
                <p>Connect your TickTick account in Settings.</p>
              )}
              {configuredProviders.length === 0 && (
                <p>Configure at least one LLM provider in Settings.</p>
              )}
              {apiVersion === 'v2' && !v2Session && !!ticktickToken && (
                <p>v2 Beta mode is active but no session found. Sign in with your TickTick credentials in Settings.</p>
              )}
              <button
                onClick={() => navigate('/settings')}
                className="mt-2 inline-flex h-8 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Go to Settings
              </button>
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

          {messages.map((msg, i) => (
            <ErrorBoundary
              key={msg.id}
              FallbackComponent={(props) => <ErrorFallback {...props} context="message" />}
            >
              <ChatMessage
                message={msg}
                isThinking={
                  loading &&
                  msg.role === 'assistant' &&
                  i === messages.length - 1 &&
                  !msg.content
                }
              />
            </ErrorBoundary>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <ChatInput
        key={conversationId ?? 'new'}
        onSend={handleSend}
        onStop={() => abortControllerRef.current?.abort()}
        disabled={!isReady}
        loading={loading}
      />
    </div>
  );
}
