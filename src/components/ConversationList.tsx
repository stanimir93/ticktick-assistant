import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Conversation } from '@/lib/db';
import { Button } from '@/components/ui/button';

interface ConversationListProps {
  activeId: string | null;
  onSelect: (conversation: Conversation) => void;
  onNewChat: () => void;
  onDelete: (id: string) => void;
}

export default function ConversationList({
  activeId,
  onSelect,
  onNewChat,
  onDelete,
}: ConversationListProps) {
  const conversations = useLiveQuery(() =>
    db.conversations.orderBy('updatedAt').reverse().toArray()
  );

  return (
    <div className="flex h-full w-64 flex-col border-r bg-muted/30">
      <div className="p-3">
        <Button onClick={onNewChat} className="w-full" size="sm">
          + New Chat
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {conversations?.map((conv) => (
          <div
            key={conv.id}
            className={`group flex items-center transition-colors hover:bg-muted ${
              conv.id === activeId ? 'bg-muted' : ''
            }`}
          >
            <button
              onClick={() => onSelect(conv)}
              className={`flex-1 px-3 py-2.5 text-left text-sm ${
                conv.id === activeId ? 'font-medium' : ''
              }`}
            >
              <div className="truncate">
                {conv.title || 'New conversation'}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {new Date(conv.updatedAt).toLocaleDateString()}
              </div>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(conv.id);
              }}
              className="mr-2 hidden rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive group-hover:block"
              title="Delete conversation"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        ))}
        {conversations?.length === 0 && (
          <p className="px-3 py-4 text-center text-xs text-muted-foreground">
            No conversations yet
          </p>
        )}
      </div>
    </div>
  );
}
