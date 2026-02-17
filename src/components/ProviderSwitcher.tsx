import type { ProviderName, ProvidersMap } from '@/lib/storage';
import { getConfiguredProviderNames } from '@/lib/storage';
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
}

export default function ProviderSwitcher({
  providers,
  activeProvider,
  onSwitch,
}: ProviderSwitcherProps) {
  const configured = getConfiguredProviderNames(providers);

  if (configured.length === 0) return null;

  return (
    <Select
      value={activeProvider ?? undefined}
      onValueChange={(v) => onSwitch(v as ProviderName)}
    >
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="Select provider" />
      </SelectTrigger>
      <SelectContent>
        {configured.map((name) => (
          <SelectItem key={name} value={name}>
            <span className="capitalize">{name}</span>
            <span className="ml-1 text-muted-foreground">
              ({providers[name]?.model})
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
