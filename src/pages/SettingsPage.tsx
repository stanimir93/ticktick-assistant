import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useLocalStorage } from '@uidotdev/usehooks';
import { Eye, EyeOff, Copy, Check } from 'lucide-react';
import type { ProvidersMap, ProviderName, ProviderConfig } from '@/lib/storage';
import { getConfiguredProviderNames } from '@/lib/storage';
import { type ApiVersion, API_VERSION_KEY, DEFAULT_API_VERSION, V2_USERNAME_KEY, V2_PASSWORD_KEY, V2_SESSION_KEY } from '@/lib/api-version';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { signIn as v2SignIn } from '@/lib/ticktick-v2';
import ProviderCard from '@/components/ProviderCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import ThemeToggle from '@/components/ThemeToggle';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

const allProviders: ProviderName[] = ['claude', 'openai', 'gemini', 'grok'];

const REDIRECT_URI = window.location.origin + import.meta.env.BASE_URL;

export default function SettingsPage() {
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
  const [credentialsSaved, setCredentialsSaved] = useState(false);
  const credentialsSavedTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [showClientId, setShowClientId] = useState(false);
  const [showClientSecret, setShowClientSecret] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // v2 Beta state
  const [apiVersion, setApiVersion] = useLocalStorage<ApiVersion>(API_VERSION_KEY, DEFAULT_API_VERSION);
  const [showBetaDialog, setShowBetaDialog] = useState(false);
  const [v2Username, setV2Username] = useLocalStorage<string>(V2_USERNAME_KEY, '');
  const [_v2Password, setV2Password] = useLocalStorage<string>(V2_PASSWORD_KEY, '');
  const [v2Session, setV2Session] = useLocalStorage<string | null>(V2_SESSION_KEY, null);
  const [v2UsernameInput, setV2UsernameInput] = useState('');
  const [v2PasswordInput, setV2PasswordInput] = useState('');
  const [v2SigningIn, setV2SigningIn] = useState(false);
  const [v2Error, setV2Error] = useState<string | null>(null);

  const handleCopy = (value: string, field: string) => {
    if (!value.trim()) return;
    navigator.clipboard.writeText(value.trim());
    setCopiedField(field);
    clearTimeout(copiedTimerRef.current);
    copiedTimerRef.current = setTimeout(() => setCopiedField(null), 1500);
  };

  const configuredProviders = getConfiguredProviderNames(providers);
  const hasClientCredentials = !!ticktickClientId && !!ticktickClientSecret;

  const handleSaveCredentials = () => {
    const id = clientIdInput.trim();
    const secret = clientSecretInput.trim();
    if (!id || !secret) return;
    setTicktickClientId(id);
    setTicktickClientSecret(secret);
    setClientIdInput('');
    setClientSecretInput('');
    setCredentialsSaved(true);
    clearTimeout(credentialsSavedTimerRef.current);
    credentialsSavedTimerRef.current = setTimeout(() => setCredentialsSaved(false), 1500);
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

  const handleV2SignIn = async () => {
    const username = v2UsernameInput.trim();
    const password = v2PasswordInput.trim();
    if (!username || !password) return;
    setV2SigningIn(true);
    setV2Error(null);
    try {
      const session = await v2SignIn(username, password);
      setV2Session(session);
      setV2Username(username);
      setV2Password(password);
      setV2UsernameInput('');
      setV2PasswordInput('');
    } catch (err) {
      setV2Error(err instanceof Error ? err.message : 'Sign-in failed');
    } finally {
      setV2SigningIn(false);
    }
  };

  const handleV2Disconnect = () => {
    setV2Session(null);
    setV2Username('');
    setV2Password('');
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
    <div className="flex h-full flex-col">
      <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-2 border-b bg-background px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/">Chats</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Settings</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </header>
      <div className="mx-auto w-full max-w-2xl flex-1 overflow-y-auto p-6">

      {/* TickTick Section */}
      <section className="mb-8">
        <h2 className="mb-4 text-lg font-semibold">TickTick Connection</h2>
        <Card>
          <CardContent className="pt-6">
            {ticktickToken ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Badge
                    variant="secondary"
                    className="bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400"
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
                {hasClientCredentials && (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label>Client ID</Label>
                      <div className="flex gap-1">
                        <Input
                          type={showClientId ? 'text' : 'password'}
                          value={ticktickClientId}
                          readOnly
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="shrink-0"
                          onClick={() => setShowClientId(!showClientId)}
                          tabIndex={-1}
                        >
                          {showClientId ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="shrink-0"
                          onClick={() => handleCopy(ticktickClientId, 'clientId')}
                          tabIndex={-1}
                        >
                          {copiedField === 'clientId' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Client Secret</Label>
                      <div className="flex gap-1">
                        <Input
                          type={showClientSecret ? 'text' : 'password'}
                          value={ticktickClientSecret}
                          readOnly
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="shrink-0"
                          onClick={() => setShowClientSecret(!showClientSecret)}
                          tabIndex={-1}
                        >
                          {showClientSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="shrink-0"
                          onClick={() => handleCopy(ticktickClientSecret, 'clientSecret')}
                          tabIndex={-1}
                        >
                          {copiedField === 'clientSecret' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
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
                      <div className="flex gap-1">
                        <Input
                          id="tt-client-id"
                          type={showClientId ? 'text' : 'password'}
                          value={clientIdInput}
                          onChange={(e) => setClientIdInput(e.target.value)}
                          placeholder="Your TickTick app Client ID"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="shrink-0"
                          onClick={() => setShowClientId(!showClientId)}
                          tabIndex={-1}
                        >
                          {showClientId ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="shrink-0"
                          onClick={() => handleCopy(clientIdInput, 'clientId')}
                          disabled={!clientIdInput.trim()}
                          tabIndex={-1}
                        >
                          {copiedField === 'clientId' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="tt-client-secret">Client Secret</Label>
                      <div className="flex gap-1">
                        <Input
                          id="tt-client-secret"
                          type={showClientSecret ? 'text' : 'password'}
                          value={clientSecretInput}
                          onChange={(e) => setClientSecretInput(e.target.value)}
                          placeholder="Your TickTick app Client Secret"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="shrink-0"
                          onClick={() => setShowClientSecret(!showClientSecret)}
                          tabIndex={-1}
                        >
                          {showClientSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="shrink-0"
                          onClick={() => handleCopy(clientSecretInput, 'clientSecret')}
                          disabled={!clientSecretInput.trim()}
                          tabIndex={-1}
                        >
                          {copiedField === 'clientSecret' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                    <Button
                      onClick={handleSaveCredentials}
                      disabled={
                        !clientIdInput.trim() || !clientSecretInput.trim() || credentialsSaved
                      }
                    >
                      {credentialsSaved ? 'Saved!' : 'Save Credentials'}
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
                      className="w-full"
                    >
                      Connect to TickTick
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* v2 Beta Toggle */}
      <section className="mb-8">
        <h2 className="mb-4 text-lg font-semibold">API Version</h2>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Use v2 API</span>
                  <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-orange-400 text-orange-500">
                    BETA
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Enables advanced features like cross-project filtering, completed tasks, tag management, and subtasks.
                </p>
              </div>
              <Switch
                checked={apiVersion === 'v2'}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setShowBetaDialog(true);
                  } else {
                    setApiVersion('v1');
                  }
                }}
              />
            </div>
          </CardContent>
        </Card>
      </section>

      <AlertDialog open={showBetaDialog} onOpenChange={setShowBetaDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Enable v2 Beta API?</AlertDialogTitle>
            <AlertDialogDescription>
              The v2 API is experimental and may be unstable. You might experience broken features, unexpected errors, or data inconsistencies. Use at your own risk.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => setApiVersion('v2')}>
              Enable Beta
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* v2 Beta Auth Section */}
      {apiVersion === 'v2' && (
        <section className="mb-8">
          <h2 className="mb-4 text-lg font-semibold flex items-center gap-2">
            v2 Beta Authentication
            <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-orange-400 text-orange-500">
              BETA
            </Badge>
          </h2>
          <Card>
            <CardContent className="pt-6">
              {v2Session ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400">
                      v2 Session Active
                    </Badge>
                    {v2Username && (
                      <span className="text-sm text-muted-foreground">({v2Username})</span>
                    )}
                  </div>
                  <Button onClick={handleV2Disconnect} variant="destructive" size="sm">
                    Disconnect
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Sign in with your TickTick account to enable advanced features like cross-project filtering, completed tasks, tag management, and subtasks.
                  </p>
                  <div className="space-y-1.5">
                    <Label htmlFor="v2-username">TickTick Email/Username</Label>
                    <Input
                      id="v2-username"
                      value={v2UsernameInput}
                      onChange={(e) => setV2UsernameInput(e.target.value)}
                      placeholder="your@email.com"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="v2-password">Password</Label>
                    <Input
                      id="v2-password"
                      type="password"
                      value={v2PasswordInput}
                      onChange={(e) => setV2PasswordInput(e.target.value)}
                      placeholder="Your TickTick password"
                    />
                  </div>
                  <Button
                    onClick={handleV2SignIn}
                    disabled={!v2UsernameInput.trim() || !v2PasswordInput.trim() || v2SigningIn}
                    className="w-full"
                  >
                    {v2SigningIn ? 'Signing in...' : 'Sign In'}
                  </Button>
                  {v2Error && (
                    <p className="text-sm text-destructive">{v2Error}</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      )}

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
    </div>
  );
}
