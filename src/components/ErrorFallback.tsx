import { AlertTriangle } from 'lucide-react';
import type { FallbackProps } from 'react-error-boundary';

interface ErrorFallbackProps extends FallbackProps {
  context?: string;
}

export default function ErrorFallback({
  error,
  resetErrorBoundary,
  context,
}: ErrorFallbackProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center">
      <AlertTriangle className="h-8 w-8 text-destructive" />
      <div>
        <p className="font-medium text-destructive">
          Something went wrong{context ? ` in ${context}` : ''}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {error instanceof Error ? error.message : 'An unexpected error occurred'}
        </p>
      </div>
      <button
        onClick={resetErrorBoundary}
        className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        Try again
      </button>
    </div>
  );
}
