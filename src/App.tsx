import { useSyncExternalStore } from 'react';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import ChatPage from '@/pages/ChatPage';
import SettingsPage from '@/pages/SettingsPage';

function getHash(): string {
  return window.location.hash || '#/';
}

function subscribeToHash(callback: () => void) {
  window.addEventListener('hashchange', callback);
  return () => window.removeEventListener('hashchange', callback);
}

export default function App() {
  const hash = useSyncExternalStore(subscribeToHash, getHash);

  let page: 'chat' | 'settings' = 'chat';
  let conversationId: string | null = null;

  if (hash === '#/settings') {
    page = 'settings';
  } else {
    const match = hash.match(/^#\/chat\/(.+)$/);
    if (match) conversationId = match[1];
  }

  return (
    <SidebarProvider>
      <AppSidebar activeConversationId={conversationId} />
      <SidebarInset>
        {page === 'settings' ? (
          <SettingsPage />
        ) : (
          <ChatPage conversationId={conversationId} />
        )}
      </SidebarInset>
    </SidebarProvider>
  );
}
