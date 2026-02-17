import { useState } from 'react';
import ChatPage from '@/pages/ChatPage';
import SettingsPage from '@/pages/SettingsPage';

type View = 'chat' | 'settings';

function getInitialView(): View {
  return window.location.hash === '#/settings' ? 'settings' : 'chat';
}

export default function App() {
  const [view, setView] = useState<View>(getInitialView);

  const navigate = (v: View) => {
    window.location.hash = v === 'settings' ? '#/settings' : '#/';
    setView(v);
  };

  if (view === 'settings') {
    return <SettingsPage onNavigateChat={() => navigate('chat')} />;
  }

  return <ChatPage onNavigateSettings={() => navigate('settings')} />;
}
