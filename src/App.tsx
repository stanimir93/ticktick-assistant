import { useEffect } from 'react';
import { Routes, Route, useNavigate, useParams } from 'react-router-dom';
import { useLocalStorage } from '@uidotdev/usehooks';
import { ErrorBoundary } from 'react-error-boundary';
import { exchangeCodeForToken } from '@/lib/ticktick';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import ErrorFallback from '@/components/ErrorFallback';
import ChatPage from '@/pages/ChatPage';
import SettingsPage from '@/pages/SettingsPage';

function ChatPageBoundary() {
  const { conversationId } = useParams<{ conversationId: string }>();
  return (
    <ErrorBoundary
      FallbackComponent={(props) => <ErrorFallback {...props} context="chat" />}
      resetKeys={[conversationId]}
    >
      <ChatPage />
    </ErrorBoundary>
  );
}

function SettingsPageBoundary() {
  return (
    <ErrorBoundary
      FallbackComponent={(props) => <ErrorFallback {...props} context="settings" />}
    >
      <SettingsPage />
    </ErrorBoundary>
  );
}

const REDIRECT_URI = window.location.origin + import.meta.env.BASE_URL;

export default function App() {
  const navigate = useNavigate();
  const [, setTicktickToken] = useLocalStorage<string | null>('ticktick-token', null);

  // Handle OAuth callback — check URL for ?code= parameter (after redirect from TickTick)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (!code) return;

    // Validate OAuth state to prevent CSRF
    const state = params.get('state');
    const expectedState = sessionStorage.getItem('ticktick-oauth-state');
    if (!state || state !== expectedState) {
      console.error('OAuth state mismatch — possible CSRF attack');
      window.history.replaceState({}, '', window.location.pathname);
      navigate('/settings');
      return;
    }
    sessionStorage.removeItem('ticktick-oauth-state');

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
    <ErrorBoundary
      FallbackComponent={(props) => <ErrorFallback {...props} context="app" />}
    >
      <SidebarProvider>
        <ErrorBoundary
          FallbackComponent={(props) => <ErrorFallback {...props} context="sidebar" />}
        >
          <AppSidebar />
        </ErrorBoundary>
        <SidebarInset>
          <Routes>
            <Route path="/" element={<ChatPageBoundary />} />
            <Route path="/chat/:conversationId" element={<ChatPageBoundary />} />
            <Route path="/settings" element={<SettingsPageBoundary />} />
          </Routes>
        </SidebarInset>
      </SidebarProvider>
    </ErrorBoundary>
  );
}
