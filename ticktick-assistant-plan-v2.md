# TickTick Assistant — V2 Features Plan

## Overview

V2 builds on top of the existing V1 app (chat interface + TickTick tools + multi-provider LLM support) and adds four features:

1. **Delete tasks** — with a confirmation step before execution
2. **Move tasks between projects** — enhanced with confirmation and target section selection
3. **Due date management** — assign, change, and remove due dates
4. **Flag tasks** — mark/unmark tasks as flagged

The biggest architectural change is the **confirmation flow** — a mechanism for pausing the tool loop on destructive actions and waiting for user approval before proceeding.

## UI Components: shadcn/ui

All new UI components use **shadcn/ui** (https://ui.shadcn.com). The project already has these shadcn components installed:

- `Button` (with variants: `default`, `destructive`, `outline`, `secondary`, `ghost`, `link`)
- `Card` (`Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`)
- `Badge`
- `Collapsible`
- `Input`, `Label`, `Select`, `Textarea`, `RadioGroup`

**Adding new components:** Use the shadcn MCP (https://ui.shadcn.com/docs/mcp) or CLI (`npx shadcn@latest add <component>`) to install any additional components needed. Potential new components for V2:

| Component | Usage |
|-----------|-------|
| `AlertDialog` | Could be used as an alternative to inline confirmation cards for delete/move actions |
| `Separator` | Visual dividers in the confirmation card between task details and actions |
| `Tooltip` | Hover hints on flag/unflag status indicators |

The **ConfirmationCard** component (new in V2) is built using the existing shadcn `Card`, `Button`, and `Badge` primitives — no new shadcn component is strictly required, but `AlertDialog` may be added if a modal confirmation pattern is preferred over inline cards.

---

## Feature 1: Delete Tasks (with Confirmation)

### What the user sees

1. User says: *"Delete the task 'Old meeting notes' from Work"*
2. LLM identifies the task and calls `delete_task`
3. **Instead of executing immediately**, the chat shows a confirmation card:
   ```
   ┌──────────────────────────────────────┐
   │  🗑  Delete task?                     │
   │                                      │
   │  "Old meeting notes"                 │
   │  Project: Work                       │
   │                                      │
   │  This action cannot be undone.       │
   │                                      │
   │  [Cancel]              [Delete]      │
   └──────────────────────────────────────┘
   ```
4. User clicks **Delete** → task is deleted, LLM confirms
5. User clicks **Cancel** → tool returns "User cancelled", LLM acknowledges

Batch delete works the same way — the confirmation card lists all tasks to be deleted.

### TickTick API

Deletion uses the existing `POST /batch/task` endpoint with a `delete` array:

```typescript
await batchTaskUpdate(token, {
  delete: [
    { taskId: "abc123", projectId: "proj456" }
  ]
});
```

The `batchTaskUpdate` function in `ticktick.ts` already accepts a `delete` property — it's just not wired up to any tool yet.

### New tools

| Tool | Description |
|------|-------------|
| `delete_task` | Delete a single task (requires confirmation) |
| `batch_delete_tasks` | Delete multiple tasks at once (requires confirmation) |

```typescript
// Tool definitions to add to tools.ts
{
  name: 'delete_task',
  description: 'Delete a task. This is destructive and cannot be undone — the user will be asked to confirm.',
  requiresConfirmation: true,  // <-- new flag
  parameters: {
    type: 'object',
    properties: {
      taskId: { type: 'string', description: 'The task ID' },
      projectId: { type: 'string', description: 'The project ID' },
      title: { type: 'string', description: 'Task title (for confirmation display)' },
    },
    required: ['taskId', 'projectId'],
  },
},
{
  name: 'batch_delete_tasks',
  description: 'Delete multiple tasks at once. Destructive and cannot be undone — user will be asked to confirm.',
  requiresConfirmation: true,
  parameters: {
    type: 'object',
    properties: {
      tasks: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            taskId: { type: 'string' },
            projectId: { type: 'string' },
            title: { type: 'string' },
          },
          required: ['taskId', 'projectId'],
        },
      },
    },
    required: ['tasks'],
  },
},
```

### Execution logic (in `executeTool`)

```typescript
case 'delete_task': {
  invalidateCache();
  const result = await ticktick.batchTaskUpdate(token, {
    delete: [{ taskId: args.taskId, projectId: args.projectId }],
  });
  return JSON.stringify(result);
}

case 'batch_delete_tasks': {
  invalidateCache();
  const tasks = args.tasks as Array<{ taskId: string; projectId: string }>;
  const result = await ticktick.batchTaskUpdate(token, {
    delete: tasks.map(t => ({ taskId: t.taskId, projectId: t.projectId })),
  });
  return JSON.stringify(result);
}
```

---

## Feature 2: Move Tasks Between Projects (Enhanced)

### Current state

V1 already has `move_task_to_project` (calls `POST /batch/taskProject`). V2 enhances it:

- **Confirmation before moving** — moving is disruptive (task leaves current project), so show a confirmation card
- **Target section selection** — optionally specify which section/column in the target project

### Changes

1. Mark `move_task_to_project` as `requiresConfirmation: true`
2. Add optional `toColumnId` parameter to place the task in a specific section of the target project
3. Add confirmation card UI showing: task title, source project, target project (+ target section if specified)

### Confirmation card

```
┌──────────────────────────────────────────┐
│  📦  Move task?                          │
│                                          │
│  "Design review feedback"                │
│  From: Work → To: Personal               │
│                                          │
│  [Cancel]                  [Move]        │
└──────────────────────────────────────────┘
```

### Updated tool definition

```typescript
{
  name: 'move_task_to_project',
  description: 'Move a task to a different project. User will be asked to confirm.',
  requiresConfirmation: true,  // <-- add this
  parameters: {
    type: 'object',
    properties: {
      taskId: { type: 'string', description: 'The task ID' },
      fromProjectId: { type: 'string', description: 'Current project ID' },
      toProjectId: { type: 'string', description: 'Target project ID' },
      toColumnId: { type: 'string', description: 'Target section/column ID in the new project (optional)' },
      title: { type: 'string', description: 'Task title (for confirmation display)' },
      fromProjectName: { type: 'string', description: 'Current project name (for confirmation display)' },
      toProjectName: { type: 'string', description: 'Target project name (for confirmation display)' },
    },
    required: ['taskId', 'fromProjectId', 'toProjectId'],
  },
},
```

---

## Feature 3: Due Date Management

### What the user sees

- *"Set the due date of 'Quarterly report' to next Friday"*
- *"Make 'Call dentist' due tomorrow at 3pm"*
- *"Remove the due date from 'Research topics'"*
- *"What tasks are due this week?"*

The LLM handles natural language date parsing (all major LLMs can do this). It converts to ISO 8601 format and passes to the tool.

### TickTick API date format

TickTick uses ISO 8601 strings with timezone:

```
"2026-02-20T16:00:00.000+0000"
```

Key task fields:
- `dueDate` — when the task is due (ISO string or `null` to clear)
- `startDate` — when to start working on it (optional)
- `isAllDay` — `true` if the date has no specific time
- `timeZone` — e.g. `"Europe/Sofia"`, required when setting dates

To **remove** a due date, set `dueDate` to `null` (or empty string) in the update payload.

### Changes

#### Extend `update_task` tool

Add `dueDate`, `startDate`, `isAllDay`, and `timeZone` parameters to the existing `update_task` tool definition:

```typescript
{
  name: 'update_task',
  description: 'Update a task — rename, change description, priority, due date, etc.',
  parameters: {
    type: 'object',
    properties: {
      taskId: { type: 'string', description: 'The task ID' },
      projectId: { type: 'string', description: 'The project ID the task belongs to' },
      title: { type: 'string', description: 'New task title' },
      content: { type: 'string', description: 'New task description' },
      priority: { type: 'number', description: 'New priority: 0=none, 1=low, 3=medium, 5=high' },
      // NEW fields:
      dueDate: {
        type: ['string', 'null'],
        description: 'Due date in ISO 8601 format (e.g. "2026-02-20T16:00:00.000+0000"), or null to remove',
      },
      startDate: {
        type: ['string', 'null'],
        description: 'Start date in ISO 8601 format, or null to remove',
      },
      isAllDay: {
        type: 'boolean',
        description: 'True if the due date is an all-day date (no specific time)',
      },
      timeZone: {
        type: 'string',
        description: 'Timezone for the due date (e.g. "Europe/Sofia", "America/New_York")',
      },
    },
    required: ['taskId', 'projectId'],
  },
},
```

#### Extend `executeTool` for `update_task`

```typescript
case 'update_task': {
  invalidateCache();
  const updatePayload: Record<string, unknown> = {
    id: args.taskId,
    projectId: args.projectId,
  };
  if (args.title !== undefined) updatePayload.title = args.title;
  if (args.content !== undefined) updatePayload.content = args.content;
  if (args.priority !== undefined) updatePayload.priority = args.priority;
  // NEW:
  if (args.dueDate !== undefined) updatePayload.dueDate = args.dueDate;
  if (args.startDate !== undefined) updatePayload.startDate = args.startDate;
  if (args.isAllDay !== undefined) updatePayload.isAllDay = args.isAllDay;
  if (args.timeZone !== undefined) updatePayload.timeZone = args.timeZone;

  const result = await ticktick.batchTaskUpdate(token, {
    update: [updatePayload],
  });
  return JSON.stringify(result);
}
```

#### Also extend `batch_update_tasks` and `create_task`

Add the same date fields to `batch_update_tasks` items and `create_task` so tasks can be created with a due date and batch operations can set dates.

#### Update system prompt

Add to the system prompt so the LLM knows about date handling:

```
When the user asks to set a due date, convert their natural language to ISO 8601 format.
Today's date context will be provided. Use the user's timezone when known, otherwise default to UTC.
When the user asks to remove a due date, set dueDate to null.
```

#### Include today's date in system prompt

Inject the current date into the system prompt dynamically so the LLM can resolve relative dates ("tomorrow", "next week"):

```typescript
const SYSTEM_PROMPT = `...
Current date and time: ${new Date().toISOString()} (${Intl.DateTimeFormat().resolvedOptions().timeZone})
...`;
```

---

## Feature 4: Flag Tasks

### Approach

TickTick does not have a native "flag" feature. Implement flagging via **tags** — add/remove a `"flagged"` tag on tasks.

### What the user sees

- *"Flag the task 'Urgent proposal'"*
- *"Unflag 'Weekly standup'"*
- *"Show me all flagged tasks"*
- *"Flag all high-priority tasks in Work"*

### New tools

| Tool | Description |
|------|-------------|
| `flag_task` | Add the "flagged" tag to a task |
| `unflag_task` | Remove the "flagged" tag from a task |
| `get_flagged_tasks` | Get all tasks that have the "flagged" tag |

```typescript
{
  name: 'flag_task',
  description: 'Flag a task by adding the "flagged" tag. Flagged tasks can be listed with get_flagged_tasks.',
  parameters: {
    type: 'object',
    properties: {
      taskId: { type: 'string', description: 'The task ID' },
      projectId: { type: 'string', description: 'The project ID' },
    },
    required: ['taskId', 'projectId'],
  },
},
{
  name: 'unflag_task',
  description: 'Unflag a task by removing the "flagged" tag.',
  parameters: {
    type: 'object',
    properties: {
      taskId: { type: 'string', description: 'The task ID' },
      projectId: { type: 'string', description: 'The project ID' },
    },
    required: ['taskId', 'projectId'],
  },
},
{
  name: 'get_flagged_tasks',
  description: 'Get all tasks across all projects that have the "flagged" tag.',
  parameters: {
    type: 'object',
    properties: {},
  },
},
```

### Execution logic

```typescript
case 'flag_task': {
  invalidateCache();
  // Fetch current task to get existing tags
  const data = await getCachedData(token);
  const task = data.syncTaskBean.update.find(
    t => t.id === args.taskId && t.projectId === args.projectId
  );
  const currentTags = task?.tags ?? [];
  if (currentTags.includes('flagged')) {
    return JSON.stringify({ message: 'Task is already flagged' });
  }
  const result = await ticktick.batchTaskUpdate(token, {
    update: [{ id: args.taskId, projectId: args.projectId, tags: [...currentTags, 'flagged'] }],
  });
  invalidateCache(); // invalidate again after mutation
  return JSON.stringify(result);
}

case 'unflag_task': {
  invalidateCache();
  const data = await getCachedData(token);
  const task = data.syncTaskBean.update.find(
    t => t.id === args.taskId && t.projectId === args.projectId
  );
  const currentTags = task?.tags ?? [];
  const result = await ticktick.batchTaskUpdate(token, {
    update: [{ id: args.taskId, projectId: args.projectId, tags: currentTags.filter(t => t !== 'flagged') }],
  });
  invalidateCache();
  return JSON.stringify(result);
}

case 'get_flagged_tasks': {
  const data = await getCachedData(token);
  const flagged = data.syncTaskBean.update.filter(
    t => t.tags?.includes('flagged') && t.status === 0
  );
  return JSON.stringify(flagged.map(t => ({
    id: t.id,
    title: t.title,
    projectId: t.projectId,
    priority: t.priority,
    dueDate: t.dueDate,
  })));
}
```

---

## Architecture: Confirmation Flow

This is the core architectural addition for V2. The existing tool loop auto-executes every tool call immediately. For destructive actions (delete, move between projects), we need to **pause and ask the user**.

### Design

#### 1. Mark tools as requiring confirmation

Add a `requiresConfirmation` flag to `ToolDefinition`:

```typescript
// In lib/llm/types.ts
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  requiresConfirmation?: boolean;  // <-- new
}
```

#### 2. Modify tool loop to yield pending confirmations

The tool loop needs to be able to **pause** when it encounters a tool call that requires confirmation. Instead of executing the tool, it returns a "pending confirmation" state and waits.

```typescript
// In lib/tool-loop.ts
export interface PendingConfirmation {
  toolCall: ToolCall;
  toolDefinition: ToolDefinition;
}

export interface ToolLoopCallbacks {
  onToolCall?: (toolCall: ToolCall) => void;
  onToolResult?: (toolCallId: string, name: string, result: string) => void;
  onText?: (text: string) => void;
  onConfirmationNeeded?: (pending: PendingConfirmation) => Promise<boolean>;  // <-- new
}
```

When the tool loop encounters a tool call that has `requiresConfirmation: true`:

1. It calls `onConfirmationNeeded(pending)` — this returns a `Promise<boolean>`
2. The promise resolves when the user clicks Confirm (`true`) or Cancel (`false`)
3. If confirmed → execute the tool and continue the loop
4. If cancelled → send a "User cancelled this action" result back to the LLM

```typescript
// Inside the tool execution loop:
for (const toolCall of parsed.toolCalls) {
  const toolDef = tools.find(t => t.name === toolCall.name);

  if (toolDef?.requiresConfirmation && callbacks?.onConfirmationNeeded) {
    const confirmed = await callbacks.onConfirmationNeeded({ toolCall, toolDefinition: toolDef });
    if (!confirmed) {
      // User cancelled — send cancellation result back to LLM
      const cancelResult = JSON.stringify({ cancelled: true, message: 'User cancelled this action' });
      callbacks?.onToolResult?.(toolCall.id, toolCall.name, cancelResult);
      const resultId = provider.name === 'gemini' ? toolCall.name : toolCall.id;
      conversationMessages.push(provider.formatToolResult(resultId, cancelResult) as Message);
      continue;
    }
  }

  callbacks?.onToolCall?.(toolCall);
  const result = await executeTool(toolCall.name, toolCall.arguments, ticktickToken);
  // ... rest of existing logic
}
```

#### 3. New component: `ConfirmationCard.tsx`

A new component rendered inline in the chat when confirmation is needed. Built entirely with **shadcn/ui** primitives:

```
src/components/ConfirmationCard.tsx
```

**shadcn components used:**
- `Card`, `CardHeader`, `CardTitle`, `CardContent`, `CardFooter` — card layout
- `Button` — Cancel (`variant="outline"`) and Confirm (`variant="destructive"` for delete, `variant="default"` for move)
- `Badge` — status indicator (pending/confirmed/cancelled) shown after resolution
- Icons from `lucide-react` (already a project dependency via shadcn): `Trash2`, `ArrowRightLeft`, `AlertTriangle`

Props:
- `type` — `'delete'` | `'move'` (determines icon and button styling)
- `details` — object with task title, project names, etc.
- `onConfirm` — callback
- `onCancel` — callback
- `status` — `'pending'` | `'confirmed'` | `'cancelled'` (once resolved, card becomes non-interactive)

**Sketch:**

```tsx
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, ArrowRightLeft } from 'lucide-react';

// Delete confirmation:
<Card className="border-destructive/30 bg-destructive/5">
  <CardHeader>
    <CardTitle className="flex items-center gap-2 text-sm">
      <Trash2 className="size-4 text-destructive" />
      Delete task?
    </CardTitle>
  </CardHeader>
  <CardContent className="text-sm">
    <p className="font-medium">"{details.title}"</p>
    <p className="text-muted-foreground">Project: {details.projectName}</p>
    <p className="text-muted-foreground text-xs mt-1">This action cannot be undone.</p>
  </CardContent>
  <CardFooter className="gap-2 justify-end">
    <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
    <Button variant="destructive" size="sm" onClick={onConfirm}>Delete</Button>
  </CardFooter>
</Card>

// Move confirmation:
<Card className="border-blue-500/30 bg-blue-500/5">
  <CardHeader>
    <CardTitle className="flex items-center gap-2 text-sm">
      <ArrowRightLeft className="size-4 text-blue-600" />
      Move task?
    </CardTitle>
  </CardHeader>
  <CardContent className="text-sm">
    <p className="font-medium">"{details.title}"</p>
    <p className="text-muted-foreground">
      From: {details.fromProjectName} → To: {details.toProjectName}
    </p>
  </CardContent>
  <CardFooter className="gap-2 justify-end">
    <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
    <Button size="sm" onClick={onConfirm}>Move</Button>
  </CardFooter>
</Card>

// Resolved state — replace buttons with a Badge:
<CardFooter>
  <Badge variant="secondary" className={confirmed ? "text-green-700 bg-green-100" : "text-red-700 bg-red-100"}>
    {confirmed ? "Confirmed" : "Cancelled"}
  </Badge>
</CardFooter>
```

Styling:
- Delete: `border-destructive/30 bg-destructive/5` tint, `Trash2` icon, `Button variant="destructive"`
- Move: `border-blue-500/30 bg-blue-500/5` tint, `ArrowRightLeft` icon, `Button variant="default"`
- Pending state: buttons active
- Resolved state: buttons replaced with a `Badge` showing "Confirmed" or "Cancelled"

#### 4. Wire up in ChatPage.tsx

The `ChatPage` creates a promise-based bridge between the tool loop and the UI:

```typescript
// In ChatPage handleSend:
onConfirmationNeeded: (pending) => {
  return new Promise<boolean>((resolve) => {
    // Add a confirmation card to the chat UI
    dispatch({
      type: 'add_confirmation',
      messageId: assistantMsgId,
      confirmation: {
        id: pending.toolCall.id,
        toolName: pending.toolCall.name,
        args: pending.toolCall.arguments,
        resolve,  // stored so button clicks can resolve the promise
      },
    });
  });
},
```

When the user clicks Confirm/Cancel on the `ConfirmationCard`, it calls `resolve(true)` or `resolve(false)`, which unblocks the tool loop.

#### 5. Updated ChatMessage types

```typescript
// In ChatMessage.tsx
export interface ConfirmationDisplay {
  id: string;
  toolName: string;
  args: Record<string, unknown>;
  status: 'pending' | 'confirmed' | 'cancelled';
  resolve?: (confirmed: boolean) => void;  // only present while pending
}

export interface ChatMessageData {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  provider?: string;
  model?: string;
  toolCalls?: ToolCallDisplay[];
  confirmations?: ConfirmationDisplay[];  // <-- new
}
```

---

## Updated System Prompt

The system prompt needs updates for V2 features:

```typescript
const SYSTEM_PROMPT = `You are a helpful TickTick task management assistant. You help users organize, manage, and update their tasks and projects in TickTick.

When the user asks about their tasks or projects, use the available tools to fetch data from TickTick. When they ask to modify tasks, use the appropriate tools to make changes.

Always be concise and clear in your responses. When listing tasks, format them in a readable way. When making changes, confirm what you did.

Important workflow:
1. First use list_projects to understand what projects exist
2. Use get_project_tasks to see tasks in a specific project
3. Use get_project_sections to understand the sections/columns in a project
4. Then use update/move/complete/delete tools to make changes as requested

Date handling:
- Current date and time: ${new Date().toISOString()} (${Intl.DateTimeFormat().resolvedOptions().timeZone})
- When setting due dates, convert natural language to ISO 8601 format (e.g. "2026-02-20T16:00:00.000+0000")
- Use the timezone "${Intl.DateTimeFormat().resolvedOptions().timeZone}" unless the user specifies otherwise
- For all-day dates (no specific time), set isAllDay to true
- To remove a due date, set dueDate to null

Flagging:
- Flag tasks by adding the "flagged" tag, unflag by removing it
- Use get_flagged_tasks to list all flagged tasks across projects

Destructive actions:
- delete_task, batch_delete_tasks, and move_task_to_project require user confirmation
- Always include the task title and project name in the tool call so the confirmation card can display them
- If the user cancels, acknowledge it and do not retry`;
```

---

## New / Modified Files Summary

| File | Change |
|------|--------|
| `src/lib/llm/types.ts` | Add `requiresConfirmation` to `ToolDefinition` |
| `src/lib/tools.ts` | Add `delete_task`, `batch_delete_tasks`, `flag_task`, `unflag_task`, `get_flagged_tasks` tools. Extend `update_task`/`batch_update_tasks`/`create_task` with date fields. Mark delete + move tools with `requiresConfirmation`. |
| `src/lib/tool-loop.ts` | Add `onConfirmationNeeded` callback. Pause loop on confirmation-required tools, handle cancel/confirm. |
| `src/components/ConfirmationCard.tsx` | **New file** — built with shadcn `Card`, `Button`, `Badge` + `lucide-react` icons |
| `src/components/ChatMessage.tsx` | Render `ConfirmationCard` inside messages when confirmations are present |
| `src/pages/ChatPage.tsx` | Wire up `onConfirmationNeeded` with promise bridge, add `confirmations` to chat reducer |
| `src/types/index.ts` | No changes needed — `Task` type already has `dueDate`, `startDate`, `tags` |
| `src/lib/ticktick.ts` | No changes needed — `batchTaskUpdate` already accepts `delete` array |

**No new shadcn components to install** — `ConfirmationCard` uses only `Card`, `Button`, and `Badge` which are already in the project. If a modal confirmation pattern is preferred later, install `AlertDialog` via `npx shadcn@latest add alert-dialog`.

---

## Implementation Steps

### Step 1: Confirmation flow architecture
- Add `requiresConfirmation` to `ToolDefinition` type in `types.ts`
- Modify `tool-loop.ts` to support `onConfirmationNeeded` callback
- Add confirmation handling logic (pause on confirmation-required tools, resume on user decision)

### Step 2: ConfirmationCard component (shadcn/ui)
- Create `src/components/ConfirmationCard.tsx` using shadcn `Card`, `Button`, `Badge` components
- Icons from `lucide-react`: `Trash2` for delete, `ArrowRightLeft` for move
- Delete card: `Button variant="destructive"` for confirm, `border-destructive/30` tint
- Move card: `Button variant="default"` for confirm, `border-blue-500/30` tint
- States: pending (interactive buttons), confirmed/cancelled (buttons replaced with `Badge`)
- Follow existing component patterns (see `ToolCallCard.tsx` for reference)

### Step 3: Wire confirmation into ChatPage
- Add `confirmations` to `ChatMessageData` and chat reducer
- Implement promise-based bridge in `handleSend`'s `onConfirmationNeeded`
- Render `ConfirmationCard` components in `ChatMessage`

### Step 4: Delete task tools
- Add `delete_task` and `batch_delete_tasks` tool definitions (with `requiresConfirmation: true`)
- Add execution logic in `executeTool`
- Update system prompt with delete guidance

### Step 5: Due date management
- Extend `update_task` tool definition with `dueDate`, `startDate`, `isAllDay`, `timeZone`
- Extend `create_task` and `batch_update_tasks` similarly
- Extend `executeTool` to pass date fields through
- Inject current date/time into system prompt
- Include `dueDate` in `get_project_tasks` output (already done in V1)

### Step 6: Flag tasks
- Add `flag_task`, `unflag_task`, `get_flagged_tasks` tool definitions
- Add execution logic (tag-based flagging)
- Update system prompt with flagging guidance

### Step 7: Move task confirmation
- Add `requiresConfirmation: true` to existing `move_task_to_project` tool
- Add display fields (`title`, `fromProjectName`, `toProjectName`) to the tool definition
- Optionally add `toColumnId` parameter for target section selection

---

## Verification

1. **Delete with confirmation:**
   - Say "Delete task X from project Y" → confirmation card appears → click Delete → task deleted
   - Say "Delete task X" → confirmation card → click Cancel → task NOT deleted, LLM acknowledges
   - Say "Delete all completed tasks in Work" → batch confirmation with task list → confirm → all deleted

2. **Move with confirmation:**
   - Say "Move task X from Work to Personal" → confirmation card shows source/target → confirm → task moved
   - Cancel → task stays in original project

3. **Due dates:**
   - Say "Set 'Quarterly report' due date to next Friday" → task updated with correct ISO date
   - Say "Make 'Call dentist' due tomorrow at 3pm" → task updated with date + time
   - Say "Remove the due date from 'Research topics'" → dueDate set to null
   - Say "What's due this week?" → LLM queries tasks and filters by dueDate

4. **Flagging:**
   - Say "Flag 'Urgent proposal'" → "flagged" tag added to task
   - Say "Unflag it" → "flagged" tag removed
   - Say "Show all flagged tasks" → lists all tasks with "flagged" tag
   - Verify "flagged" tag appears in TickTick app
