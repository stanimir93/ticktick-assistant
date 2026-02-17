import { useState, useEffect } from 'react';
import { useLocalStorage } from '@uidotdev/usehooks';
import type { ProvidersMap, ProviderName, ProviderConfig } from '@/lib/storage';
import { getConfiguredProviderNames } from '@/lib/storage';
import { exchangeCodeForToken } from '@/lib/ticktick';
import ProviderCard from '@/components/ProviderCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

const allProviders: ProviderName[] = ['claude', 'openai', 'gemini', 'grok'];

const REDIRECT_URI = window.location.origin + window.location.pathname;

interface SettingsPageProps {
  onNavigateChat: () => void;
}

export default function SettingsPage({ onNavigateChat }: SettingsPageProps) {
  const [providers, setProviders] = useLocalStorage<ProvidersMap>(
    'llm-providers',
    {}
  );
  const [activeProvider, setActiveProvider] = useLocalStorage<string | null>(
    'active-provider',
    null
  );
  const [ticktickToken, setTicktickToken] = useLocalStorage<string | null>(
    'ticktick-token',
    null
  );
  const [ticktickClientId, setTicktickClientId] = useLocalStorage<string>(
    'ticktick-client-id',
    ''
  );
  const [ticktickClientSecret, setTicktickClientSecret] =
    useLocalStorage<string>('ticktick-client-secret', '');

  const [clientIdInput, setClientIdInput] = useState('');
  const [clientSecretInput, setClientSecretInput] = useState('');
  const [oauthStatus, setOauthStatus] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const [exchanging, setExchanging] = useState(false);

  const configuredProviders = getConfiguredProviderNames(providers);
  const hasClientCredentials = !!ticktickClientId && !!ticktickClientSecret;

  // Handle OAuth callback — check URL for ?code= parameter
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (!code) return;

    // Clean URL
    window.history.replaceState({}, '', window.location.pathname + '#/settings');

    const storedClientId = localStorage.getItem('ticktick-client-id');
    const storedClientSecret = localStorage.getItem('ticktick-client-secret');
    if (!storedClientId || !storedClientSecret) {
      setOauthStatus({
        ok: false,
        message: 'Client credentials not found. Please save them first.',
      });
      return;
    }

    // Parse stored values (useLocalStorage stores JSON-encoded strings)
    const clientId = JSON.parse(storedClientId) as string;
    const clientSecret = JSON.parse(storedClientSecret) as string;

    setExchanging(true);
    exchangeCodeForToken(code, clientId, clientSecret, REDIRECT_URI)
      .then(({ accessToken }) => {
        setTicktickToken(accessToken);
        setOauthStatus({ ok: true, message: 'Connected to TickTick!' });
      })
      .catch((err) => {
        setOauthStatus({
          ok: false,
          message: err instanceof Error ? err.message : 'Token exchange failed',
        });
      })
      .finally(() => setExchanging(false));
  }, [setTicktickToken]);

  const handleSaveCredentials = () => {
    const id = clientIdInput.trim();
    const secret = clientSecretInput.trim();
    if (!id || !secret) return;
    setTicktickClientId(id);
    setTicktickClientSecret(secret);
    setClientIdInput('');
    setClientSecretInput('');
  };

  const handleAuthorize = () => {
    const state = crypto.randomUUID();
    sessionStorage.setItem('ticktick-oauth-state', state);
    const params = new URLSearchParams({
      client_id: ticktickClientId,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: 'tasks:read tasks:write',
      state,
    });
    window.location.href = `https://ticktick.com/oauth/authorize?${params}`;
  };

  const handleProviderSave = (name: ProviderName, config: ProviderConfig) => {
    setProviders((prev) => ({ ...prev, [name]: config }));
    if (!activeProvider) {
      setActiveProvider(name);
    }
  };

  const handleProviderRemove = (name: ProviderName) => {
    setProviders((prev) => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
    if (activeProvider === name) {
      const remaining = configuredProviders.filter((p) => p !== name);
      setActiveProvider(remaining[0] ?? null);
    }
  };

  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Settings</h1>
        <Button onClick={onNavigateChat}>Back to Chat</Button>
      </div>

      {/* TickTick Section */}
      <section className="mb-8">
        <h2 className="mb-4 text-lg font-semibold">TickTick Connection</h2>
        <Card>
          <CardContent className="pt-6">
            {ticktickToken ? (
              <div className="flex items-center justify-between">
                <Badge
                  variant="secondary"
                  className="bg-green-100 text-green-700"
                >
                  Connected to TickTick
                </Badge>
                <Button
                  onClick={() => setTicktickToken(null)}
                  variant="destructive"
                  size="sm"
                >
                  Disconnect
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {!hasClientCredentials ? (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Create an app at{' '}
                      <a
                        href="https://developer.ticktick.com/manage"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline text-primary"
                      >
                        developer.ticktick.com
                      </a>{' '}
                      and set the redirect URI to:
                    </p>
                    <code className="block rounded bg-muted p-2 text-xs break-all">
                      {REDIRECT_URI}
                    </code>
                    <div className="space-y-1.5">
                      <Label htmlFor="tt-client-id">Client ID</Label>
                      <Input
                        id="tt-client-id"
                        value={clientIdInput}
                        onChange={(e) => setClientIdInput(e.target.value)}
                        placeholder="Your TickTick app Client ID"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="tt-client-secret">Client Secret</Label>
                      <Input
                        id="tt-client-secret"
                        type="password"
                        value={clientSecretInput}
                        onChange={(e) => setClientSecretInput(e.target.value)}
                        placeholder="Your TickTick app Client Secret"
                      />
                    </div>
                    <Button
                      onClick={handleSaveCredentials}
                      disabled={
                        !clientIdInput.trim() || !clientSecretInput.trim()
                      }
                    >
                      Save Credentials
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary">
                        Client credentials saved
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setTicktickClientId('');
                          setTicktickClientSecret('');
                        }}
                      >
                        Reset Credentials
                      </Button>
                    </div>
                    <Button
                      onClick={handleAuthorize}
                      disabled={exchanging}
                      className="w-full"
                    >
                      {exchanging
                        ? 'Exchanging token...'
                        : 'Connect to TickTick'}
                    </Button>
                  </div>
                )}
              </div>
            )}
            {oauthStatus && (
              <p
                className={`mt-2 text-sm ${
                  oauthStatus.ok ? 'text-green-600' : 'text-destructive'
                }`}
              >
                {oauthStatus.message}
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      {/* LLM Providers Section */}
      <section className="mb-8">
        <h2 className="mb-4 text-lg font-semibold">LLM Providers</h2>
        <div className="grid gap-4">
          {allProviders.map((name) => (
            <ProviderCard
              key={name}
              name={name}
              config={providers[name]}
              onSave={(config) => handleProviderSave(name, config)}
              onRemove={() => handleProviderRemove(name)}
            />
          ))}
        </div>
      </section>

      {/* Active Provider Selector */}
      {configuredProviders.length > 0 && (
        <section>
          <h2 className="mb-4 text-lg font-semibold">Active Provider</h2>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Select which provider to use for chat
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RadioGroup
                value={activeProvider ?? ''}
                onValueChange={setActiveProvider}
              >
                {configuredProviders.map((name) => (
                  <div key={name} className="flex items-center gap-3">
                    <RadioGroupItem value={name} id={`active-${name}`} />
                    <Label
                      htmlFor={`active-${name}`}
                      className="flex cursor-pointer items-center gap-2"
                    >
                      <span className="capitalize">{name}</span>
                      <span className="text-xs text-muted-foreground">
                        ({providers[name]?.model})
                      </span>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
}
