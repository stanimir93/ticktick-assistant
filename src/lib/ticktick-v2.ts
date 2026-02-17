import ky from 'ky';

const PROXY_URL = import.meta.env.VITE_PROXY_URL || '';

function api(sessionToken: string) {
  return ky.create({
    prefixUrl: PROXY_URL || undefined,
    headers: {
      'X-Ticktick-Session': sessionToken,
    },
  });
}

// --- Auth ---

export interface SignInResponse {
  token: string;
  userId: string;
  username: string;
  _sessionToken: string;
}

export async function signIn(
  username: string,
  password: string
): Promise<string> {
  const data = await ky
    .post(`${PROXY_URL}/api/ticktick-v2/user/signon?wc=true&remember=true`, {
      json: { username, password },
      headers: {
        'Content-Type': 'application/json',
      },
    })
    .json<SignInResponse>();
  return data._sessionToken;
}

// --- Batch Check (full state sync) ---

export interface BatchCheckResponse {
  syncTaskBean: {
    update: BatchTask[];
  };
  projectProfiles: BatchProject[];
  tags: BatchTag[];
  inboxId: string;
}

export interface BatchTask {
  id: string;
  projectId: string;
  title: string;
  content?: string;
  desc?: string;
  status: number;
  priority: number;
  tags?: string[];
  dueDate?: string;
  startDate?: string;
  isAllDay?: boolean;
  items?: {
    id: string;
    title: string;
    status: number;
  }[];
  parentId?: string;
  childIds?: string[];
  completedTime?: string;
  sortOrder?: number;
}

export interface BatchProject {
  id: string;
  name: string;
  color?: string;
  closed?: boolean;
  groupId?: string;
  sortOrder?: number;
}

export interface BatchTag {
  name: string;
  label: string;
  color?: string;
  sortOrder?: number;
  sortType?: string;
}

export async function batchCheck(
  sessionToken: string
): Promise<BatchCheckResponse> {
  return api(sessionToken)
    .get('api/ticktick-v2/batch/check/0', {
      searchParams: {},
    })
    .json<BatchCheckResponse>();
}

// --- Completed Tasks ---

export interface CompletedTask {
  id: string;
  projectId: string;
  title: string;
  status: number;
  priority: number;
  tags?: string[];
  completedTime: string;
  dueDate?: string;
}

export async function getCompletedTasks(
  sessionToken: string,
  from: string,
  to: string
): Promise<CompletedTask[]> {
  return api(sessionToken)
    .get('api/ticktick-v2/project/all/completedInAll/', {
      searchParams: { from, to, limit: '999' },
    })
    .json<CompletedTask[]>();
}

// --- Subtask ---

export async function makeSubtask(
  sessionToken: string,
  taskId: string,
  parentId: string,
  projectId: string
): Promise<unknown> {
  return api(sessionToken)
    .post('api/ticktick-v2/batch/taskParent', {
      json: [
        {
          taskId,
          parentId,
          projectId,
        },
      ],
    })
    .json();
}

// --- Tags ---

export async function createTag(
  sessionToken: string,
  name: string,
  color?: string
): Promise<unknown> {
  return api(sessionToken)
    .post('api/ticktick-v2/tag', {
      json: { label: name, name: name.toLowerCase(), color },
    })
    .json();
}

export async function renameTag(
  sessionToken: string,
  oldName: string,
  newName: string
): Promise<unknown> {
  return api(sessionToken)
    .put('api/ticktick-v2/tag/rename', {
      json: { name: oldName, newName },
    })
    .json();
}

export async function deleteTag(
  sessionToken: string,
  name: string
): Promise<void> {
  await api(sessionToken).delete('api/ticktick-v2/tag', {
    json: { name },
  });
}

export async function mergeTags(
  sessionToken: string,
  from: string,
  to: string
): Promise<unknown> {
  return api(sessionToken)
    .put('api/ticktick-v2/tag/merge', {
      json: { from, to },
    })
    .json();
}
