import type { ToolDefinition } from './llm/types';
import * as ticktick from './ticktick';

export const toolDefinitions: ToolDefinition[] = [
  {
    name: 'list_projects',
    description:
      'Get all TickTick projects/lists. Returns project names, IDs, and metadata.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_project_tasks',
    description:
      'Get all tasks in a specific project. Can filter by project name or ID.',
    parameters: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'The project ID to get tasks for',
        },
      },
      required: ['projectId'],
    },
  },
  {
    name: 'get_project_sections',
    description: 'Get all sections/columns for a specific project.',
    parameters: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'The project ID to get sections for',
        },
      },
      required: ['projectId'],
    },
  },
  {
    name: 'create_task',
    description: 'Create a new task in a project.',
    parameters: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'The project ID to create the task in',
        },
        title: { type: 'string', description: 'Task title' },
        content: { type: 'string', description: 'Task description/notes' },
        priority: {
          type: 'number',
          description: 'Priority: 0=none, 1=low, 3=medium, 5=high',
        },
        columnId: {
          type: 'string',
          description: 'Section/column ID to place the task in',
        },
        dueDate: {
          type: ['string', 'null'],
          description:
            'Due date in ISO 8601 format (e.g. "2026-02-20T16:00:00.000+0000"), or null',
        },
        startDate: {
          type: ['string', 'null'],
          description: 'Start date in ISO 8601 format, or null',
        },
        isAllDay: {
          type: 'boolean',
          description: 'True if the due date is an all-day date (no specific time)',
        },
        timeZone: {
          type: 'string',
          description:
            'Timezone for the due date (e.g. "Europe/Sofia", "America/New_York")',
        },
      },
      required: ['projectId', 'title'],
    },
  },
  {
    name: 'update_task',
    description:
      'Update a task — rename, change description, priority, due date, etc.',
    parameters: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'The task ID' },
        projectId: {
          type: 'string',
          description: 'The project ID the task belongs to',
        },
        title: { type: 'string', description: 'New task title' },
        content: { type: 'string', description: 'New task description' },
        priority: {
          type: 'number',
          description: 'New priority: 0=none, 1=low, 3=medium, 5=high',
        },
        dueDate: {
          type: ['string', 'null'],
          description:
            'Due date in ISO 8601 format (e.g. "2026-02-20T16:00:00.000+0000"), or null to remove',
        },
        startDate: {
          type: ['string', 'null'],
          description: 'Start date in ISO 8601 format, or null to remove',
        },
        isAllDay: {
          type: 'boolean',
          description:
            'True if the due date is an all-day date (no specific time)',
        },
        timeZone: {
          type: 'string',
          description:
            'Timezone for the due date (e.g. "Europe/Sofia", "America/New_York")',
        },
      },
      required: ['taskId', 'projectId'],
    },
  },
  {
    name: 'move_task_to_section',
    description:
      'Move a task to a different section/column within the same project.',
    parameters: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'The task ID' },
        projectId: { type: 'string', description: 'The project ID' },
        columnId: {
          type: 'string',
          description: 'Target section/column ID',
        },
      },
      required: ['taskId', 'projectId', 'columnId'],
    },
  },
  {
    name: 'move_task_to_project',
    description:
      'Move a task to a different project. User will be asked to confirm.',
    requiresConfirmation: true,
    parameters: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'The task ID' },
        fromProjectId: {
          type: 'string',
          description: 'Current project ID',
        },
        toProjectId: {
          type: 'string',
          description: 'Target project ID',
        },
        toColumnId: {
          type: 'string',
          description:
            'Target section/column ID in the new project (optional)',
        },
        title: {
          type: 'string',
          description: 'Task title (for confirmation display)',
        },
        fromProjectName: {
          type: 'string',
          description: 'Current project name (for confirmation display)',
        },
        toProjectName: {
          type: 'string',
          description: 'Target project name (for confirmation display)',
        },
      },
      required: ['taskId', 'fromProjectId', 'toProjectId'],
    },
  },
  {
    name: 'complete_task',
    description: 'Mark a task as completed.',
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
    name: 'batch_update_tasks',
    description:
      'Update multiple tasks at once. Each task object must include taskId and projectId plus fields to update.',
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
              content: { type: 'string' },
              priority: { type: 'number' },
              columnId: { type: 'string' },
              status: { type: 'number' },
              dueDate: { type: ['string', 'null'] },
              startDate: { type: ['string', 'null'] },
              isAllDay: { type: 'boolean' },
              timeZone: { type: 'string' },
            },
            required: ['taskId', 'projectId'],
          },
          description: 'Array of task updates',
        },
      },
      required: ['tasks'],
    },
  },
  {
    name: 'delete_task',
    description:
      'Delete a task. This is destructive and cannot be undone — the user will be asked to confirm.',
    requiresConfirmation: true,
    parameters: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'The task ID' },
        projectId: { type: 'string', description: 'The project ID' },
        title: {
          type: 'string',
          description: 'Task title (for confirmation display)',
        },
      },
      required: ['taskId', 'projectId'],
    },
  },
  {
    name: 'batch_delete_tasks',
    description:
      'Delete multiple tasks at once. Destructive and cannot be undone — user will be asked to confirm.',
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
  {
    name: 'flag_task',
    description:
      'Flag a task by adding the "flagged" tag. Flagged tasks can be listed with get_flagged_tasks.',
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
    description:
      'Get all tasks across all projects that have the "flagged" tag.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
];

// Cached data from batch/check to avoid repeated fetches
let cachedData: Awaited<ReturnType<typeof ticktick.getAllData>> | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 30_000; // 30 seconds

async function getCachedData(token: string) {
  const now = Date.now();
  if (!cachedData || now - cacheTimestamp > CACHE_TTL) {
    cachedData = await ticktick.getAllData(token);
    cacheTimestamp = now;
  }
  return cachedData;
}

export function invalidateCache() {
  cachedData = null;
  cacheTimestamp = 0;
}

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  token: string
): Promise<string> {
  try {
    switch (name) {
      case 'list_projects': {
        const data = await getCachedData(token);
        const projects = data.projectProfiles.map((p) => ({
          id: p.id,
          name: p.name,
          color: p.color,
          kind: p.kind,
        }));
        return JSON.stringify(projects);
      }

      case 'get_project_tasks': {
        const data = await getCachedData(token);
        const tasks = data.syncTaskBean.update.filter(
          (t) => t.projectId === args.projectId
        );
        return JSON.stringify(
          tasks.map((t) => ({
            id: t.id,
            title: t.title,
            content: t.content,
            status: t.status,
            priority: t.priority,
            columnId: t.columnId,
            tags: t.tags,
            dueDate: t.dueDate,
          }))
        );
      }

      case 'get_project_sections': {
        const sections = await ticktick.getProjectSections(
          token,
          args.projectId as string
        );
        return JSON.stringify(sections);
      }

      case 'create_task': {
        invalidateCache();
        const newTask: Record<string, unknown> = {
          id: crypto.randomUUID().replace(/-/g, '').slice(0, 24),
          projectId: args.projectId,
          title: args.title,
          content: args.content || '',
          priority: args.priority ?? 0,
          columnId: args.columnId,
          status: 0,
        };
        if (args.dueDate !== undefined) newTask.dueDate = args.dueDate;
        if (args.startDate !== undefined) newTask.startDate = args.startDate;
        if (args.isAllDay !== undefined) newTask.isAllDay = args.isAllDay;
        if (args.timeZone !== undefined) newTask.timeZone = args.timeZone;
        const result = await ticktick.batchTaskUpdate(token, {
          add: [newTask],
        });
        return JSON.stringify(result);
      }

      case 'update_task': {
        invalidateCache();
        const updatePayload: Record<string, unknown> = {
          id: args.taskId,
          projectId: args.projectId,
        };
        if (args.title !== undefined) updatePayload.title = args.title;
        if (args.content !== undefined) updatePayload.content = args.content;
        if (args.priority !== undefined) updatePayload.priority = args.priority;
        if (args.dueDate !== undefined) updatePayload.dueDate = args.dueDate;
        if (args.startDate !== undefined)
          updatePayload.startDate = args.startDate;
        if (args.isAllDay !== undefined) updatePayload.isAllDay = args.isAllDay;
        if (args.timeZone !== undefined) updatePayload.timeZone = args.timeZone;
        const result = await ticktick.batchTaskUpdate(token, {
          update: [updatePayload],
        });
        return JSON.stringify(result);
      }

      case 'move_task_to_section': {
        invalidateCache();
        const result = await ticktick.batchTaskUpdate(token, {
          update: [
            {
              id: args.taskId,
              projectId: args.projectId,
              columnId: args.columnId,
            },
          ],
        });
        return JSON.stringify(result);
      }

      case 'move_task_to_project': {
        invalidateCache();
        const result = await ticktick.moveTaskToProject(token, [
          {
            taskId: args.taskId as string,
            fromProjectId: args.fromProjectId as string,
            toProjectId: args.toProjectId as string,
          },
        ]);
        return JSON.stringify(result);
      }

      case 'complete_task': {
        invalidateCache();
        const result = await ticktick.batchTaskUpdate(token, {
          update: [
            {
              id: args.taskId,
              projectId: args.projectId,
              status: 2,
            },
          ],
        });
        return JSON.stringify(result);
      }

      case 'batch_update_tasks': {
        invalidateCache();
        const tasks = args.tasks as Array<Record<string, unknown>>;
        const updates = tasks.map((t) => {
          const update: Record<string, unknown> = {
            id: t.taskId,
            projectId: t.projectId,
          };
          if (t.title !== undefined) update.title = t.title;
          if (t.content !== undefined) update.content = t.content;
          if (t.priority !== undefined) update.priority = t.priority;
          if (t.columnId !== undefined) update.columnId = t.columnId;
          if (t.status !== undefined) update.status = t.status;
          if (t.dueDate !== undefined) update.dueDate = t.dueDate;
          if (t.startDate !== undefined) update.startDate = t.startDate;
          if (t.isAllDay !== undefined) update.isAllDay = t.isAllDay;
          if (t.timeZone !== undefined) update.timeZone = t.timeZone;
          return update;
        });
        const result = await ticktick.batchTaskUpdate(token, {
          update: updates,
        });
        return JSON.stringify(result);
      }

      case 'delete_task': {
        invalidateCache();
        const result = await ticktick.batchTaskUpdate(token, {
          delete: [{ taskId: args.taskId, projectId: args.projectId }],
        });
        return JSON.stringify(result);
      }

      case 'batch_delete_tasks': {
        invalidateCache();
        const tasks = args.tasks as Array<{
          taskId: string;
          projectId: string;
        }>;
        const result = await ticktick.batchTaskUpdate(token, {
          delete: tasks.map((t) => ({
            taskId: t.taskId,
            projectId: t.projectId,
          })),
        });
        return JSON.stringify(result);
      }

      case 'flag_task': {
        invalidateCache();
        const data = await getCachedData(token);
        const task = data.syncTaskBean.update.find(
          (t) => t.id === args.taskId && t.projectId === args.projectId
        );
        const currentTags = task?.tags ?? [];
        if (currentTags.includes('flagged')) {
          return JSON.stringify({ message: 'Task is already flagged' });
        }
        const result = await ticktick.batchTaskUpdate(token, {
          update: [
            {
              id: args.taskId,
              projectId: args.projectId,
              tags: [...currentTags, 'flagged'],
            },
          ],
        });
        invalidateCache();
        return JSON.stringify(result);
      }

      case 'unflag_task': {
        invalidateCache();
        const data = await getCachedData(token);
        const task = data.syncTaskBean.update.find(
          (t) => t.id === args.taskId && t.projectId === args.projectId
        );
        const currentTags = task?.tags ?? [];
        const result = await ticktick.batchTaskUpdate(token, {
          update: [
            {
              id: args.taskId,
              projectId: args.projectId,
              tags: currentTags.filter((t) => t !== 'flagged'),
            },
          ],
        });
        invalidateCache();
        return JSON.stringify(result);
      }

      case 'get_flagged_tasks': {
        const data = await getCachedData(token);
        const flagged = data.syncTaskBean.update.filter(
          (t) => t.tags?.includes('flagged') && t.status === 0
        );
        return JSON.stringify(
          flagged.map((t) => ({
            id: t.id,
            title: t.title,
            projectId: t.projectId,
            priority: t.priority,
            dueDate: t.dueDate,
          }))
        );
      }

      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` });
    }
  } catch (err) {
    return JSON.stringify({
      error: err instanceof Error ? err.message : 'Unknown error',
    });
  }
}
