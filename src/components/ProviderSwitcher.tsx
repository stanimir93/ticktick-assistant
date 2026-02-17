import type { ProviderName, ProvidersMap } from '@/lib/storage';
import { getConfiguredProviderNames } from '@/lib/storage';
import { getProvider } from '@/lib/llm';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ProviderSwitcherProps {
  providers: ProvidersMap;
  activeProvider: string | null;
  onSwitch: (provider: ProviderName) => void;
  onModelChange: (model: string) => void;
}

export default function ProviderSwitcher({
  providers,
  activeProvider,
  onSwitch,
  onModelChange,
}: ProviderSwitcherProps) {
  const configured = getConfiguredProviderNames(providers);

  if (configured.length === 0) return null;

  const activeConfig = activeProvider
    ? providers[activeProvider as ProviderName]
    : undefined;
  const modelOptions = activeProvider
    ? getProvider(activeProvider as ProviderName).models.options
    : [];

  return (
    <div className="flex items-center gap-2">
      <Select
        value={activeProvider ?? undefined}
        onValueChange={(v) => onSwitch(v as ProviderName)}
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Select provider" />
        </SelectTrigger>
        <SelectContent>
          {configured.map((name) => (
            <SelectItem key={name} value={name}>
              <span className="capitalize">{name}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {activeConfig && modelOptions.length > 0 && (
        <Select
          value={activeConfig.model}
          onValueChange={onModelChange}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Select model" />
          </SelectTrigger>
          <SelectContent>
            {modelOptions.map((model) => (
              <SelectItem key={model} value={model}>
                {model}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
