import type { ToolDefinition } from './llm/types';
import * as ticktick from './ticktick';

export const toolDefinitions: ToolDefinition[] = [
  {
    name: 'list_projects',
    description: 'Get all TickTick projects/lists. Returns project names and IDs.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_project_tasks',
    description: 'Get all tasks in a specific project by project ID.',
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
        dueDate: {
          type: ['string', 'null'],
          description: 'Due date in ISO 8601 format (e.g. "2026-02-20T16:00:00.000+0000")',
        },
        startDate: {
          type: ['string', 'null'],
          description: 'Start date in ISO 8601 format',
        },
        isAllDay: {
          type: 'boolean',
          description: 'True if the due date is all-day (no specific time)',
        },
        timeZone: {
          type: 'string',
          description: 'Timezone (e.g. "Europe/Sofia", "America/New_York")',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Tags to assign to the task',
        },
      },
      required: ['projectId', 'title'],
    },
  },
  {
    name: 'update_task',
    description: 'Update a task — rename, change description, priority, due date, tags, etc.',
    parameters: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'The task ID' },
        projectId: { type: 'string', description: 'The project ID the task belongs to' },
        title: { type: 'string', description: 'New task title' },
        content: { type: 'string', description: 'New task description' },
        priority: {
          type: 'number',
          description: 'New priority: 0=none, 1=low, 3=medium, 5=high',
        },
        dueDate: {
          type: ['string', 'null'],
          description: 'Due date in ISO 8601 format, or null to remove',
        },
        startDate: {
          type: ['string', 'null'],
          description: 'Start date in ISO 8601 format, or null to remove',
        },
        isAllDay: {
          type: 'boolean',
          description: 'True if the due date is all-day (no specific time)',
        },
        timeZone: {
          type: 'string',
          description: 'Timezone for the due date',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Replace all tags on the task',
        },
      },
      required: ['taskId', 'projectId'],
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
    name: 'delete_task',
    description: 'Delete a task. This is destructive and cannot be undone — the user will be asked to confirm.',
    requiresConfirmation: true,
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
];

// Cache for project data
let projectsCache: ticktick.Project[] | null = null;
let projectsCacheTime = 0;
const CACHE_TTL = 30_000;

async function getCachedProjects(token: string) {
  const now = Date.now();
  if (!projectsCache || now - projectsCacheTime > CACHE_TTL) {
    projectsCache = await ticktick.getProjects(token);
    projectsCacheTime = now;
  }
  return projectsCache;
}

export function invalidateCache() {
  projectsCache = null;
  projectsCacheTime = 0;
}

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  token: string
): Promise<string> {
  try {
    switch (name) {
      case 'list_projects': {
        const projects = await getCachedProjects(token);
        return JSON.stringify(
          projects.map((p) => ({
            id: p.id,
            name: p.name,
            color: p.color,
            kind: p.kind,
          }))
        );
      }

      case 'get_project_tasks': {
        const data = await ticktick.getProjectData(
          token,
          args.projectId as string
        );
        return JSON.stringify(
          (data.tasks ?? []).map((t) => ({
            id: t.id,
            title: t.title,
            content: t.content,
            status: t.status,
            priority: t.priority,
            tags: t.tags,
            dueDate: t.dueDate,
          }))
        );
      }

      case 'create_task': {
        invalidateCache();
        const task = await ticktick.createTask(token, {
          title: args.title as string,
          projectId: args.projectId as string,
          content: args.content as string | undefined,
          priority: args.priority as number | undefined,
          dueDate: args.dueDate as string | undefined,
          startDate: args.startDate as string | undefined,
          isAllDay: args.isAllDay as boolean | undefined,
          timeZone: args.timeZone as string | undefined,
          tags: args.tags as string[] | undefined,
        });
        return JSON.stringify(task);
      }

      case 'update_task': {
        invalidateCache();
        const updates: Record<string, unknown> = {
          projectId: args.projectId,
        };
        if (args.title !== undefined) updates.title = args.title;
        if (args.content !== undefined) updates.content = args.content;
        if (args.priority !== undefined) updates.priority = args.priority;
        if (args.dueDate !== undefined) updates.dueDate = args.dueDate;
        if (args.startDate !== undefined) updates.startDate = args.startDate;
        if (args.isAllDay !== undefined) updates.isAllDay = args.isAllDay;
        if (args.timeZone !== undefined) updates.timeZone = args.timeZone;
        if (args.tags !== undefined) updates.tags = args.tags;
        const task = await ticktick.updateTask(
          token,
          args.taskId as string,
          updates as Parameters<typeof ticktick.updateTask>[2]
        );
        return JSON.stringify(task);
      }

      case 'complete_task': {
        invalidateCache();
        await ticktick.completeTask(
          token,
          args.projectId as string,
          args.taskId as string
        );
        return JSON.stringify({ success: true });
      }

      case 'delete_task': {
        invalidateCache();
        await ticktick.deleteTask(
          token,
          args.projectId as string,
          args.taskId as string
        );
        return JSON.stringify({ success: true });
      }

      case 'flag_task': {
        // Get current task to read existing tags
        const data = await ticktick.getProjectData(
          token,
          args.projectId as string
        );
        const task = data.tasks?.find((t) => t.id === args.taskId);
        const currentTags = task?.tags ?? [];
        if (currentTags.includes('flagged')) {
          return JSON.stringify({ message: 'Task is already flagged' });
        }
        invalidateCache();
        const updated = await ticktick.updateTask(
          token,
          args.taskId as string,
          { tags: [...currentTags, 'flagged'], projectId: args.projectId as string }
        );
        return JSON.stringify(updated);
      }

      case 'unflag_task': {
        const data = await ticktick.getProjectData(
          token,
          args.projectId as string
        );
        const task = data.tasks?.find((t) => t.id === args.taskId);
        const currentTags = task?.tags ?? [];
        invalidateCache();
        const updated = await ticktick.updateTask(
          token,
          args.taskId as string,
          {
            tags: currentTags.filter((t) => t !== 'flagged'),
            projectId: args.projectId as string,
          }
        );
        return JSON.stringify(updated);
      }

      case 'get_flagged_tasks': {
        const projects = await getCachedProjects(token);
        const allFlagged: Array<Record<string, unknown>> = [];
        for (const project of projects) {
          try {
            const data = await ticktick.getProjectData(token, project.id);
            const flagged = (data.tasks ?? []).filter(
              (t) => t.tags?.includes('flagged') && t.status === 0
            );
            for (const t of flagged) {
              allFlagged.push({
                id: t.id,
                title: t.title,
                projectId: t.projectId,
                projectName: project.name,
                priority: t.priority,
                dueDate: t.dueDate,
              });
            }
          } catch {
            // Skip projects that fail to load
          }
        }
        return JSON.stringify(allFlagged);
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
