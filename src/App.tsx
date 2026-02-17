import { useSyncExternalStore } from 'react';
import ChatPage from '@/pages/ChatPage';
import SettingsPage from '@/pages/SettingsPage';

type View = 'chat' | 'settings';

function hashToView(): View {
  return window.location.hash === '#/settings' ? 'settings' : 'chat';
}

function subscribeToHash(callback: () => void) {
  window.addEventListener('hashchange', callback);
  return () => window.removeEventListener('hashchange', callback);
}

export default function App() {
  const view = useSyncExternalStore(subscribeToHash, hashToView);

  if (view === 'settings') {
    return <SettingsPage />;
  }

  return <ChatPage />;
}
