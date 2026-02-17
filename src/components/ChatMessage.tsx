import Markdown from 'react-markdown';
import { Badge } from '@/components/ui/badge';
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
    title: args.title as string | undefined,
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

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-lg px-4 py-2.5 ${
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-foreground'
        }`}
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
          <ToolCallCard
            key={tc.id}
            name={tc.name}
            args={tc.args}
            result={tc.result}
          />
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
            className={`prose prose-sm max-w-none ${isUser ? 'prose-invert' : ''}`}
          >
            {isUser ? (
              <p className="m-0">{message.content}</p>
            ) : (
              <Markdown>{message.content}</Markdown>
            )}
          </div>
        )}

        {isThinking && <ThinkingIndicator />}
      </div>
    </div>
  );
}
