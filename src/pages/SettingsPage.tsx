import { useState } from 'react';
import { useLocalStorage } from '@uidotdev/usehooks';
import type { ProvidersMap, ProviderName, ProviderConfig } from '@/lib/storage';
import { getConfiguredProviderNames } from '@/lib/storage';
import { login } from '@/lib/ticktick';
import ProviderCard from '@/components/ProviderCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

const allProviders: ProviderName[] = ['claude', 'openai', 'gemini', 'grok'];

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

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [manualToken, setManualToken] = useState('');
  const [loginMode, setLoginMode] = useState<'login' | 'token'>('login');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginResult, setLoginResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  const configuredProviders = getConfiguredProviderNames(providers);

  const handleTickTickLogin = async () => {
    if (!email.trim() || !password.trim()) return;
    setLoginLoading(true);
    setLoginResult(null);
    try {
      const { token } = await login(email, password);
      setTicktickToken(token);
      setEmail('');
      setPassword('');
      setLoginResult({ ok: true, message: 'Connected to TickTick!' });
    } catch (err) {
      setLoginResult({
        ok: false,
        message: err instanceof Error ? err.message : 'Login failed',
      });
    } finally {
      setLoginLoading(false);
    }
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
                <div className="flex gap-2">
                  <Button
                    variant={loginMode === 'login' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setLoginMode('login')}
                  >
                    Email & Password
                  </Button>
                  <Button
                    variant={loginMode === 'token' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setLoginMode('token')}
                  >
                    Paste Token
                  </Button>
                </div>

                {loginMode === 'login' ? (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="tt-email">Email</Label>
                      <Input
                        id="tt-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="your@email.com"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="tt-password">Password</Label>
                      <Input
                        id="tt-password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                      />
                    </div>
                    <Button
                      onClick={handleTickTickLogin}
                      disabled={
                        !email.trim() || !password.trim() || loginLoading
                      }
                    >
                      {loginLoading ? 'Connecting...' : 'Connect'}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="tt-token">Session Token</Label>
                      <Input
                        id="tt-token"
                        type="password"
                        value={manualToken}
                        onChange={(e) => setManualToken(e.target.value)}
                        placeholder="Paste your TickTick session token"
                      />
                      <p className="text-xs text-muted-foreground">
                        Go to ticktick.com &rarr; DevTools (F12) &rarr; Application &rarr; Cookies &rarr; copy the <code className="rounded bg-muted px-1">t</code> value
                      </p>
                    </div>
                    <Button
                      onClick={() => {
                        if (manualToken.trim()) {
                          setTicktickToken(manualToken.trim());
                          setManualToken('');
                          setLoginResult({ ok: true, message: 'Token saved!' });
                        }
                      }}
                      disabled={!manualToken.trim()}
                    >
                      Save Token
                    </Button>
                  </div>
                )}
              </div>
            )}
            {loginResult && (
              <p
                className={`mt-2 text-sm ${
                  loginResult.ok ? 'text-green-600' : 'text-destructive'
                }`}
              >
                {loginResult.message}
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
