import { Fragment } from 'react';
import type { ProviderName, ProvidersMap } from '@/lib/storage';
import { getConfiguredProviderNames } from '@/lib/storage';
import { getProvider } from '@/lib/llm';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ProviderSwitcherProps {
  providers: ProvidersMap;
  activeProvider: string | null;
  onChange: (provider: ProviderName, model: string) => void;
  disabled?: boolean;
}

const providerLabels: Record<ProviderName, string> = {
  claude: 'Claude',
  openai: 'OpenAI',
  gemini: 'Gemini',
  grok: 'Grok',
};

export default function ProviderSwitcher({
  providers,
  activeProvider,
  onChange,
  disabled,
}: ProviderSwitcherProps) {
  const configured = getConfiguredProviderNames(providers);

  if (configured.length === 0) return null;

  const activeConfig = activeProvider
    ? providers[activeProvider as ProviderName]
    : undefined;

  const currentValue =
    activeProvider && activeConfig
      ? `${activeProvider}:${activeConfig.model}`
      : undefined;

  const handleChange = (value: string) => {
    const sep = value.indexOf(':');
    const provider = value.slice(0, sep) as ProviderName;
    const model = value.slice(sep + 1);
    onChange(provider, model);
  };

  return (
    <Select value={currentValue} onValueChange={handleChange} disabled={disabled}>
      <SelectTrigger className="w-[140px] sm:w-[200px]">
        <SelectValue placeholder="Select model" />
      </SelectTrigger>
      <SelectContent>
        {configured.map((name, i) => {
          const models = getProvider(name).models.options;
          return (
            <Fragment key={name}>
              {i > 0 && <SelectSeparator />}
              <SelectGroup>
                <SelectLabel>{providerLabels[name]}</SelectLabel>
                {models.map((model) => (
                  <SelectItem key={`${name}:${model}`} value={`${name}:${model}`}>
                    {model}
                  </SelectItem>
                ))}
              </SelectGroup>
            </Fragment>
          );
        })}
      </SelectContent>
    </Select>
  );
}
