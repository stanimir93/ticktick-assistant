import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface ToolCallCardProps {
  name: string;
  args: Record<string, unknown>;
  result?: string;
}

export default function ToolCallCard({ name, args, result }: ToolCallCardProps) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="my-1">
      <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-md border bg-muted/50 px-3 py-1.5 text-xs hover:bg-muted">
        <svg
          className={`h-3 w-3 shrink-0 transition-transform ${open ? 'rotate-90' : ''}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
            clipRule="evenodd"
          />
        </svg>
        <code className="font-medium text-primary">{name}</code>
        {result !== undefined ? (
          <Badge variant="secondary" className="ml-auto text-green-700 bg-green-100">
            done
          </Badge>
        ) : (
          <Badge variant="secondary" className="ml-auto text-amber-700 bg-amber-100">
            running...
          </Badge>
        )}
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-1 rounded-md border bg-muted/30 px-3 py-2 text-xs space-y-2">
        <div>
          <span className="font-medium text-muted-foreground">Arguments:</span>
          <pre className="mt-1 overflow-x-auto whitespace-pre-wrap">
            {JSON.stringify(args, null, 2)}
          </pre>
        </div>
        {result !== undefined && (
          <div>
            <span className="font-medium text-muted-foreground">Result:</span>
            <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap">
              {(() => {
                try {
                  return JSON.stringify(JSON.parse(result), null, 2);
                } catch {
                  return result;
                }
              })()}
            </pre>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
