import ky from 'ky';

const PROXY_URL = import.meta.env.VITE_PROXY_URL || '';

function api(token: string) {
  return ky.create({
    prefixUrl: PROXY_URL || undefined,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

// --- OAuth ---

export function getAuthorizeUrl(clientId: string, redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'tasks:read tasks:write',
    state,
  });
  return `https://ticktick.com/oauth/authorize?${params}`;
}

export async function exchangeCodeForToken(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<{ accessToken: string }> {
  const data = await ky
    .post(`${PROXY_URL}/api/ticktick-oauth/token`, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    })
    .json<{ access_token: string }>();
  return { accessToken: data.access_token };
}

// --- Projects ---

export interface Project {
  id: string;
  name: string;
  color?: string;
  sortOrder?: number;
  kind?: string;
}

export async function getProjects(token: string): Promise<Project[]> {
  return api(token).get('api/ticktick/project').json<Project[]>();
}

// --- Tasks ---

export interface Task {
  id: string;
  projectId: string;
  title: string;
  content?: string;
  status: number; // 0=open, 2=completed
  priority: number; // 0=none, 1=low, 3=medium, 5=high
  tags?: string[];
  dueDate?: string;
  startDate?: string;
  isAllDay?: boolean;
  timeZone?: string;
}

export interface ProjectData {
  project: Project;
  tasks: Task[];
}

export async function getProjectData(
  token: string,
  projectId: string
): Promise<ProjectData> {
  return api(token)
    .get(`api/ticktick/project/${projectId}/data`)
    .json<ProjectData>();
}

export async function createTask(
  token: string,
  task: {
    title: string;
    projectId: string;
    content?: string;
    priority?: number;
    dueDate?: string;
    startDate?: string;
    isAllDay?: boolean;
    timeZone?: string;
    tags?: string[];
  }
): Promise<Task> {
  return api(token).post('api/ticktick/task', { json: task }).json<Task>();
}

export async function updateTask(
  token: string,
  taskId: string,
  updates: {
    title?: string;
    content?: string;
    priority?: number;
    dueDate?: string | null;
    startDate?: string | null;
    isAllDay?: boolean;
    timeZone?: string;
    tags?: string[];
    projectId?: string;
  }
): Promise<Task> {
  const res = await api(token).post(`api/ticktick/task/${taskId}`, {
    json: updates,
  });
  const text = await res.text();
  return text ? (JSON.parse(text) as Task) : ({} as Task);
}

export async function deleteTask(
  token: string,
  projectId: string,
  taskId: string
): Promise<void> {
  await api(token).delete(`api/ticktick/task/${projectId}/${taskId}`);
}

export async function completeTask(
  token: string,
  projectId: string,
  taskId: string
): Promise<void> {
  await api(token).post(
    `api/ticktick/project/${projectId}/task/${taskId}/complete`
  );
}
