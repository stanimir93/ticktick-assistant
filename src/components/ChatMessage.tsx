import { useState, useCallback } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ErrorBoundary } from 'react-error-boundary';
import { Copy, Check, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import ErrorFallback from './ErrorFallback';
import ToolCallCard from './ToolCallCard';
import ConfirmationCard from './ConfirmationCard';
import type { ConfirmationDetails } from './ConfirmationCard';

export interface ToolCallDisplay {
  id: string;
  name: string;
  args: Record<string, unknown>;
  result?: string;
}

export interface ConfirmationDisplay {
  id: string;
  toolName: string;
  args: Record<string, unknown>;
  status: 'pending' | 'confirmed' | 'cancelled';
  resolve?: (confirmed: boolean) => void;
}

export interface ChatMessageData {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  provider?: string;
  model?: string;
  toolCalls?: ToolCallDisplay[];
  confirmations?: ConfirmationDisplay[];
}

interface ChatMessageProps {
  message: ChatMessageData;
  isThinking?: boolean;
}

function getConfirmationType(
  toolName: string
): 'delete' | 'move' {
  if (toolName.includes('delete')) return 'delete';
  return 'move';
}

function getConfirmationDetails(
  args: Record<string, unknown>
): ConfirmationDetails {
  // Batch delete
  if (args.tasks && Array.isArray(args.tasks)) {
    return {
      tasks: (args.tasks as Array<Record<string, unknown>>).map((t) => ({
        title: t.title as string | undefined,
        projectName: t.projectName as string | undefined,
      })),
    };
  }

  return {
    title: (args.title ?? args.name) as string | undefined,
    projectName: args.projectName as string | undefined,
    fromProjectName: args.fromProjectName as string | undefined,
    toProjectName: args.toProjectName as string | undefined,
  };
}

function ThinkingIndicator() {
  return (
    <div className="flex items-center gap-1 py-1">
      <span className="text-xs text-muted-foreground">Thinking</span>
      <span className="flex gap-0.5">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:0ms]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:150ms]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:300ms]" />
      </span>
    </div>
  );
}

export default function ChatMessage({ message, isThinking }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(message.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [message.content]);

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={
          isUser
            ? 'max-w-[80%] rounded-2xl px-4 py-2.5 bg-zinc-100 text-zinc-900 dark:bg-zinc-700 dark:text-zinc-100'
            : 'w-full text-foreground'
        }
      >
        {!isUser && message.provider && (
          <div className="mb-1.5">
            <Badge variant="outline" className="text-xs font-normal">
              {message.provider}
              {message.model ? ` · ${message.model}` : ''}
            </Badge>
          </div>
        )}

        {message.toolCalls?.map((tc) => (
          <ErrorBoundary
            key={tc.id}
            FallbackComponent={(props) => <ErrorFallback {...props} context="tool call" />}
          >
            <ToolCallCard
              name={tc.name}
              args={tc.args}
              result={tc.result}
            />
          </ErrorBoundary>
        ))}

        {message.confirmations?.map((conf) => (
          <ConfirmationCard
            key={conf.id}
            type={getConfirmationType(conf.toolName)}
            details={getConfirmationDetails(conf.args)}
            status={conf.status}
            onConfirm={() => conf.resolve?.(true)}
            onCancel={() => conf.resolve?.(false)}
          />
        ))}

        {message.content && (
          <div
            className="prose prose-sm max-w-none dark:prose-invert"
          >
            {isUser ? (
              <p className="m-0">{message.content}</p>
            ) : (
              <Markdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h3: ({ children, ...props }) => (
                    <h3 {...props} className="text-base font-semibold mt-6 mb-3">
                      {children}
                    </h3>
                  ),
                  li: ({ children, ...props }) => (
                    <li {...props} className="mb-3 pb-3 border-b border-border/40 last:border-0 last:mb-0 last:pb-0">
                      {children}
                    </li>
                  ),
                  strong: ({ children, ...props }) => (
                    <strong {...props} className="font-semibold">
                      {children}
                    </strong>
                  ),
                  em: ({ children, ...props }) => (
                    <em {...props} className="text-muted-foreground font-light not-italic text-xs">
                      {children}
                    </em>
                  ),
                  a: ({ children, href, ...props }) => {
                    if (
                      !href ||
                      href.includes('{') ||
                      href.includes('}') ||
                      href.includes('undefined') ||
                      href.includes('null')
                    ) {
                      return <span>{children}</span>;
                    }
                    const isTickTick = href.includes('ticktick.com/webapp');
                    return (
                      <a
                        {...props}
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500/50 hover:text-blue-500 no-underline inline-flex items-center align-baseline transition-colors"
                      >
                        {isTickTick ? (
                          <ExternalLink className="inline h-3.5 w-3.5" />
                        ) : (
                          children
                        )}
                      </a>
                    );
                  },
                }}
              >
                {message.content}
              </Markdown>
            )}
          </div>
        )}

        {isThinking && <ThinkingIndicator />}

        {message.content && !isThinking && (
          <div className={`mt-2 flex ${isUser ? 'justify-end' : 'justify-start'}`}>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 text-xs transition-colors text-muted-foreground hover:text-foreground"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-green-500 dark:text-green-400" />
                  <span className="text-green-500 dark:text-green-400">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
