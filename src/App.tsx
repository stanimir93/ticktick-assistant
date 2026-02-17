import { useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { useLocalStorage } from '@uidotdev/usehooks';
import { exchangeCodeForToken } from '@/lib/ticktick';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import ChatPage from '@/pages/ChatPage';
import SettingsPage from '@/pages/SettingsPage';

const REDIRECT_URI = window.location.origin + import.meta.env.BASE_URL;

export default function App() {
  const navigate = useNavigate();
  const [, setTicktickToken] = useLocalStorage<string | null>('ticktick-token', null);

  // Handle OAuth callback — check URL for ?code= parameter (after redirect from TickTick)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (!code) return;

    // Clean URL
    window.history.replaceState({}, '', window.location.pathname);

    const storedClientId = localStorage.getItem('ticktick-client-id');
    const storedClientSecret = localStorage.getItem('ticktick-client-secret');
    if (!storedClientId || !storedClientSecret) return;

    const clientId = JSON.parse(storedClientId) as string;
    const clientSecret = JSON.parse(storedClientSecret) as string;

    exchangeCodeForToken(code, clientId, clientSecret, REDIRECT_URI)
      .then(({ accessToken }) => {
        setTicktickToken(accessToken);
        navigate('/settings');
      })
      .catch((err) => {
        console.error('OAuth token exchange failed:', err);
        navigate('/settings');
      });
  }, [setTicktickToken, navigate]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
        e.preventDefault();
        navigate('/');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <Routes>
          <Route path="/" element={<ChatPage />} />
          <Route path="/chat/:conversationId" element={<ChatPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </SidebarInset>
    </SidebarProvider>
  );
}
