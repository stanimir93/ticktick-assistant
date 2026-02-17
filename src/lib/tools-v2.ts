import type { ToolDefinition } from './llm/types';
import { toolDefinitions as v1ToolDefinitions, executeTool as executeV1Tool } from './tools';
import * as v2 from './ticktick-v2';

// V2-only tool definitions
const v2OnlyTools: ToolDefinition[] = [
  {
    name: 'filter_tasks',
    description:
      'Filter tasks across ALL projects. Supports filtering by status, project, tag, priority, and date range. Much more powerful than get_project_tasks since it works cross-project.',
    parameters: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          description: 'Filter by status: "open", "completed", or "all". Default: "open"',
        },
        projectId: {
          type: 'string',
          description: 'Filter to a specific project ID',
        },
        tag: {
          type: 'string',
          description: 'Filter by tag name',
        },
        priority: {
          type: 'number',
          description: 'Filter by priority: 0=none, 1=low, 3=medium, 5=high',
        },
        dueBefore: {
          type: 'string',
          description: 'Filter tasks due before this ISO date',
        },
        dueAfter: {
          type: 'string',
          description: 'Filter tasks due after this ISO date',
        },
        search: {
          type: 'string',
          description: 'Search in task title (case-insensitive)',
        },
      },
    },
  },
  {
    name: 'get_completed_tasks',
    description:
      'Get completed tasks across all projects within a date range. Use this when users ask about finished/done tasks.',
    parameters: {
      type: 'object',
      properties: {
        from: {
          type: 'string',
          description: 'Start date in ISO 8601 format (e.g. "2026-02-01T00:00:00.000+0000")',
        },
        to: {
          type: 'string',
          description: 'End date in ISO 8601 format (e.g. "2026-02-17T23:59:59.000+0000")',
        },
      },
      required: ['from', 'to'],
    },
  },
  {
    name: 'make_subtask',
    description:
      'Make a task a subtask of another task (create parent-child relationship). Both tasks must be in the same project.',
    parameters: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'The task ID to make a subtask',
        },
        parentId: {
          type: 'string',
          description: 'The parent task ID',
        },
        projectId: {
          type: 'string',
          description: 'The project ID both tasks belong to',
        },
      },
      required: ['taskId', 'parentId', 'projectId'],
    },
  },
  {
    name: 'get_all_tags',
    description: 'Get all tags in the user\'s TickTick account.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'create_tag',
    description: 'Create a new tag.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Tag name' },
        color: { type: 'string', description: 'Tag color (hex code)' },
      },
      required: ['name'],
    },
  },
  {
    name: 'rename_tag',
    description: 'Rename an existing tag. All tasks with this tag will be updated.',
    parameters: {
      type: 'object',
      properties: {
        oldName: { type: 'string', description: 'Current tag name' },
        newName: { type: 'string', description: 'New tag name' },
      },
      required: ['oldName', 'newName'],
    },
  },
  {
    name: 'delete_tag',
    description: 'Delete a tag. The tag will be removed from all tasks.',
    requiresConfirmation: true,
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Tag name to delete' },
      },
      required: ['name'],
    },
  },
  {
    name: 'merge_tags',
    description: 'Merge one tag into another. All tasks with the source tag will get the target tag instead.',
    parameters: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'Source tag name (will be removed)' },
        to: { type: 'string', description: 'Target tag name (will be kept)' },
      },
      required: ['from', 'to'],
    },
  },
  {
    name: 'batch_sync',
    description:
      'Get a full overview of all tasks, projects, and tags. Returns task count, all projects, and all tags. Useful for getting a big picture view.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
];

// Combined v2 tools: all v1 tools + v2-only tools
export const toolDefinitions: ToolDefinition[] = [
  ...v1ToolDefinitions,
  ...v2OnlyTools,
];

// Batch sync cache
let batchCache: v2.BatchCheckResponse | null = null;
let batchCacheTime = 0;
const CACHE_TTL = 30_000;

async function getCachedBatch(sessionToken: string) {
  const now = Date.now();
  if (!batchCache || now - batchCacheTime > CACHE_TTL) {
    batchCache = await v2.batchCheck(sessionToken);
    batchCacheTime = now;
  }
  return batchCache;
}

export function invalidateV2Cache() {
  batchCache = null;
  batchCacheTime = 0;
}

// V2-only tool names for routing
const v2ToolNames = new Set(v2OnlyTools.map((t) => t.name));

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  oauthToken: string,
  sessionToken: string
): Promise<string> {
  // Delegate v1 tools to v1 executor
  if (!v2ToolNames.has(name)) {
    return executeV1Tool(name, args, oauthToken);
  }

  try {
    switch (name) {
      case 'filter_tasks': {
        const batch = await getCachedBatch(sessionToken);
        let tasks = batch.syncTaskBean.update;

        const status = (args.status as string) || 'open';
        if (status === 'open') {
          tasks = tasks.filter((t) => t.status === 0);
        } else if (status === 'completed') {
          tasks = tasks.filter((t) => t.status === 2);
        }

        if (args.projectId) {
          tasks = tasks.filter((t) => t.projectId === args.projectId);
        }
        if (args.tag) {
          const tag = (args.tag as string).toLowerCase();
          tasks = tasks.filter((t) => t.tags?.some((tg) => tg.toLowerCase() === tag));
        }
        if (args.priority !== undefined) {
          tasks = tasks.filter((t) => t.priority === args.priority);
        }
        if (args.dueBefore) {
          const before = new Date(args.dueBefore as string).getTime();
          tasks = tasks.filter((t) => t.dueDate && new Date(t.dueDate).getTime() <= before);
        }
        if (args.dueAfter) {
          const after = new Date(args.dueAfter as string).getTime();
          tasks = tasks.filter((t) => t.dueDate && new Date(t.dueDate).getTime() >= after);
        }
        if (args.search) {
          const search = (args.search as string).toLowerCase();
          tasks = tasks.filter((t) => t.title.toLowerCase().includes(search));
        }

        // Build project name map for display
        const projectMap = new Map(batch.projectProfiles.map((p) => [p.id, p.name]));

        return JSON.stringify(
          tasks.map((t) => ({
            id: t.id,
            title: t.title,
            projectId: t.projectId,
            projectName: projectMap.get(t.projectId) ?? 'Unknown',
            status: t.status,
            priority: t.priority,
            tags: t.tags,
            dueDate: t.dueDate,
            startDate: t.startDate,
            parentId: t.parentId,
          }))
        );
      }

      case 'get_completed_tasks': {
        const tasks = await v2.getCompletedTasks(
          sessionToken,
          args.from as string,
          args.to as string
        );
        return JSON.stringify(
          tasks.map((t) => ({
            id: t.id,
            title: t.title,
            projectId: t.projectId,
            priority: t.priority,
            tags: t.tags,
            completedTime: t.completedTime,
            dueDate: t.dueDate,
          }))
        );
      }

      case 'make_subtask': {
        invalidateV2Cache();
        await v2.makeSubtask(
          sessionToken,
          args.taskId as string,
          args.parentId as string,
          args.projectId as string
        );
        return JSON.stringify({ success: true });
      }

      case 'get_all_tags': {
        const batch = await getCachedBatch(sessionToken);
        return JSON.stringify(
          batch.tags.map((t) => ({
            name: t.name,
            label: t.label,
            color: t.color,
          }))
        );
      }

      case 'create_tag': {
        invalidateV2Cache();
        await v2.createTag(sessionToken, args.name as string, args.color as string | undefined);
        return JSON.stringify({ success: true, name: args.name });
      }

      case 'rename_tag': {
        invalidateV2Cache();
        await v2.renameTag(sessionToken, args.oldName as string, args.newName as string);
        return JSON.stringify({ success: true });
      }

      case 'delete_tag': {
        invalidateV2Cache();
        await v2.deleteTag(sessionToken, args.name as string);
        return JSON.stringify({ success: true });
      }

      case 'merge_tags': {
        invalidateV2Cache();
        await v2.mergeTags(sessionToken, args.from as string, args.to as string);
        return JSON.stringify({ success: true });
      }

      case 'batch_sync': {
        const batch = await getCachedBatch(sessionToken);
        const openTasks = batch.syncTaskBean.update.filter((t) => t.status === 0);
        return JSON.stringify({
          totalOpenTasks: openTasks.length,
          projects: batch.projectProfiles.map((p) => ({
            id: p.id,
            name: p.name,
            taskCount: openTasks.filter((t) => t.projectId === p.id).length,
          })),
          tags: batch.tags.map((t) => ({
            name: t.name,
            label: t.label,
            color: t.color,
          })),
        });
      }

      default:
        return JSON.stringify({ error: `Unknown v2 tool: ${name}` });
    }
  } catch (err) {
    return JSON.stringify({
      error: err instanceof Error ? err.message : 'Unknown error',
    });
  }
}
