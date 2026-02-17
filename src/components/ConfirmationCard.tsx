import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, ArrowRightLeft } from 'lucide-react';

export interface ConfirmationDetails {
  title?: string;
  projectName?: string;
  fromProjectName?: string;
  toProjectName?: string;
  tasks?: Array<{ title?: string; projectName?: string }>;
}

interface ConfirmationCardProps {
  type: 'delete' | 'move';
  details: ConfirmationDetails;
  status: 'pending' | 'confirmed' | 'cancelled';
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmationCard({
  type,
  details,
  status,
  onConfirm,
  onCancel,
}: ConfirmationCardProps) {
  const isDelete = type === 'delete';
  const isBatch = details.tasks && details.tasks.length > 0;

  return (
    <Card
      className={`my-2 ${
        isDelete
          ? 'border-destructive/30 bg-destructive/5'
          : 'border-blue-500/30 bg-blue-500/5'
      }`}
    >
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          {isDelete ? (
            <Trash2 className="size-4 text-destructive" />
          ) : (
            <ArrowRightLeft className="size-4 text-blue-600" />
          )}
          {isDelete ? 'Delete?' : 'Move task?'}
          {isBatch && ` (${details.tasks!.length} tasks)`}
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-2 text-sm">
        {isBatch ? (
          <ul className="list-inside list-disc space-y-0.5">
            {details.tasks!.map((t, i) => (
              <li key={i} className="font-medium">
                {t.title ?? 'Untitled'}
              </li>
            ))}
          </ul>
        ) : (
          <p className="font-medium">"{details.title ?? 'Untitled'}"</p>
        )}
        {isDelete && details.projectName && (
          <p className="text-muted-foreground">
            Project: {details.projectName}
          </p>
        )}
        {!isDelete && (
          <p className="text-muted-foreground">
            From: {details.fromProjectName ?? '?'} &rarr; To:{' '}
            {details.toProjectName ?? '?'}
          </p>
        )}
        {isDelete && (
          <p className="mt-1 text-xs text-muted-foreground">
            This action cannot be undone.
          </p>
        )}
      </CardContent>
      <CardFooter className="justify-end gap-2">
        {status === 'pending' ? (
          <>
            <Button variant="outline" size="sm" onClick={onCancel}>
              Cancel
            </Button>
            {isDelete ? (
              <Button variant="destructive" size="sm" onClick={onConfirm}>
                Delete
              </Button>
            ) : (
              <Button size="sm" onClick={onConfirm}>
                Move
              </Button>
            )}
          </>
        ) : (
          <Badge
            variant="secondary"
            className={
              status === 'confirmed'
                ? 'bg-green-100 text-green-700'
                : 'bg-red-100 text-red-700'
            }
          >
            {status === 'confirmed' ? 'Confirmed' : 'Cancelled'}
          </Badge>
        )}
      </CardFooter>
    </Card>
  );
}
