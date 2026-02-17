import { useState, useRef } from 'react';
import { Eye, EyeOff, Copy, Check } from 'lucide-react';
import type { ProviderName, ProviderConfig } from '@/lib/storage';
import { getProvider } from '@/lib/llm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ProviderCardProps {
  name: ProviderName;
  config?: ProviderConfig;
  onSave: (config: ProviderConfig) => void;
  onRemove: () => void;
}

const providerLabels: Record<ProviderName, string> = {
  claude: 'Claude (Anthropic)',
  openai: 'OpenAI',
  gemini: 'Gemini (Google)',
  grok: 'Grok (xAI)',
};

export default function ProviderCard({
  name,
  config,
  onSave,
  onRemove,
}: ProviderCardProps) {
  const provider = getProvider(name);
  const [apiKey, setApiKey] = useState(config?.apiKey ?? '');
  const [model, setModel] = useState(config?.model ?? provider.models.default);
  const [testing, setTesting] = useState(false);
  const [saved, setSaved] = useState(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const isConfigured = !!config?.apiKey;

  const handleCopy = () => {
    if (!apiKey.trim()) return;
    navigator.clipboard.writeText(apiKey.trim());
    setCopied(true);
    clearTimeout(copiedTimerRef.current);
    copiedTimerRef.current = setTimeout(() => setCopied(false), 1500);
  };

  const handleSave = () => {
    if (!apiKey.trim()) return;
    onSave({ apiKey: apiKey.trim(), model });
    setTestResult(null);
    setSaved(true);
    clearTimeout(savedTimerRef.current);
    savedTimerRef.current = setTimeout(() => setSaved(false), 1500);
  };

  const handleTest = async () => {
    if (!apiKey.trim()) return;
    setTesting(true);
    setTestResult(null);
    try {
      const request = provider.buildRequest(
        [{ role: 'user', content: 'Say "hello" and nothing else.' }],
        [],
        model,
        apiKey.trim()
      );
      const response = await fetch(request.url, {
        method: 'POST',
        headers: request.headers,
        body: JSON.stringify(request.body),
      });
      if (response.ok) {
        setTestResult({ ok: true, message: 'Connection successful!' });
      } else {
        const text = await response.text();
        setTestResult({
          ok: false,
          message: `Error ${response.status}: ${text.slice(0, 100)}`,
        });
      }
    } catch (err) {
      setTestResult({
        ok: false,
        message: err instanceof Error ? err.message : 'Connection failed',
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card className={isConfigured ? 'border-green-300 bg-green-50/50 dark:border-green-800/40 dark:bg-green-950/20' : ''}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{providerLabels[name]}</CardTitle>
          {isConfigured && (
            <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400">
              Configured
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor={`${name}-key`}>API Key</Label>
          <div className="flex gap-1">
            <Input
              id={`${name}-key`}
              type={showApiKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={isConfigured ? '••••••••' : 'Enter API key'}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0"
              onClick={() => setShowApiKey(!showApiKey)}
              tabIndex={-1}
            >
              {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0"
              onClick={handleCopy}
              disabled={!apiKey.trim()}
              tabIndex={-1}
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`${name}-model`}>Model</Label>
          <Select value={model} onValueChange={setModel}>
            <SelectTrigger id={`${name}-model`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {provider.models.options.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={!apiKey.trim() || saved} size="sm">
            {saved ? 'Saved!' : 'Save'}
          </Button>
          <Button
            onClick={handleTest}
            disabled={!apiKey.trim() || testing}
            variant="outline"
            size="sm"
          >
            {testing ? 'Testing...' : 'Test'}
          </Button>
          {isConfigured && (
            <Button onClick={onRemove} variant="destructive" size="sm">
              Remove
            </Button>
          )}
        </div>

        {testResult && (
          <p
            className={`text-sm ${
              testResult.ok ? 'text-green-600 dark:text-green-400' : 'text-destructive'
            }`}
          >
            {testResult.message}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
