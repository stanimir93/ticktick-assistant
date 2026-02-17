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
  closed?: boolean;
  groupId?: string;
  viewMode?: string;
  permission?: string;
  kind?: string;
}

export async function getProjects(token: string): Promise<Project[]> {
  return api(token).get('api/ticktick/project').json<Project[]>();
}

export async function getProject(token: string, projectId: string): Promise<Project> {
  return api(token).get(`api/ticktick/project/${projectId}`).json<Project>();
}

export async function createProject(
  token: string,
  project: {
    name: string;
    color?: string;
    sortOrder?: number;
    viewMode?: string;
    kind?: string;
  }
): Promise<Project> {
  return api(token).post('api/ticktick/project', { json: project }).json<Project>();
}

export async function updateProject(
  token: string,
  projectId: string,
  updates: {
    name?: string;
    color?: string;
    sortOrder?: number;
    viewMode?: string;
    kind?: string;
  }
): Promise<Project> {
  const res = await api(token).post(`api/ticktick/project/${projectId}`, {
    json: updates,
  });
  const text = await res.text();
  return text ? (JSON.parse(text) as Project) : ({} as Project);
}

export async function deleteProject(token: string, projectId: string): Promise<void> {
  await api(token).delete(`api/ticktick/project/${projectId}`);
}

// --- Tasks ---

export interface ChecklistItem {
  id: string;
  title: string;
  status: number; // 0=unchecked, 1=checked
  completedTime?: string;
  isAllDay?: boolean;
  sortOrder?: number;
  startDate?: string;
  timeZone?: string;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  content?: string;
  desc?: string;
  status: number; // 0=open, 2=completed
  priority: number; // 0=none, 1=low, 3=medium, 5=high
  tags?: string[];
  dueDate?: string;
  startDate?: string;
  isAllDay?: boolean;
  timeZone?: string;
  reminders?: string[];
  repeatFlag?: string;
  items?: ChecklistItem[];
  sortOrder?: number;
  completedTime?: string;
}

export interface Column {
  id: string;
  projectId: string;
  name: string;
  sortOrder?: number;
}

export interface ProjectData {
  project: Project;
  tasks: Task[];
  columns?: Column[];
}

export async function getProjectData(
  token: string,
  projectId: string
): Promise<ProjectData> {
  return api(token)
    .get(`api/ticktick/project/${projectId}/data`)
    .json<ProjectData>();
}

export async function getTask(
  token: string,
  projectId: string,
  taskId: string
): Promise<Task> {
  return api(token)
    .get(`api/ticktick/project/${projectId}/task/${taskId}`)
    .json<Task>();
}

export async function createTask(
  token: string,
  task: {
    title: string;
    projectId: string;
    content?: string;
    desc?: string;
    priority?: number;
    dueDate?: string;
    startDate?: string;
    isAllDay?: boolean;
    timeZone?: string;
    tags?: string[];
    reminders?: string[];
    repeatFlag?: string;
    items?: ChecklistItem[];
    sortOrder?: number;
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
    desc?: string;
    priority?: number;
    dueDate?: string | null;
    startDate?: string | null;
    isAllDay?: boolean;
    timeZone?: string;
    tags?: string[];
    projectId?: string;
    reminders?: string[];
    repeatFlag?: string | null;
    items?: ChecklistItem[];
    sortOrder?: number;
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
  await api(token).delete(`api/ticktick/project/${projectId}/task/${taskId}`);
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
