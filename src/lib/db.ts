import Dexie, { type EntityTable } from 'dexie';

export interface StoredMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  provider?: string;
  model?: string;
  toolCalls?: Array<{
    id: string;
    name: string;
    args: Record<string, unknown>;
    result?: string;
  }>;
  confirmations?: Array<{
    id: string;
    toolName: string;
    args: Record<string, unknown>;
    status: 'pending' | 'confirmed' | 'cancelled';
  }>;
}

export interface Conversation {
  id: string;
  title: string;
  messages: StoredMessage[];
  createdAt: number;
  updatedAt: number;
}

const db = new Dexie('ticktick-assistant') as Dexie & {
  conversations: EntityTable<Conversation, 'id'>;
};

db.version(1).stores({
  conversations: 'id, updatedAt',
});

export { db };
