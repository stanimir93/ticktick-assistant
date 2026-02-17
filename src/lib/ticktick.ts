const PROXY_URL = import.meta.env.VITE_PROXY_URL || '';

function authHeaders(token: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

async function safeJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Invalid JSON response: ${text.slice(0, 200)}`);
  }
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
  const res = await fetch(`${PROXY_URL}/api/ticktick-oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed: ${text}`);
  }
  const data = await res.json();
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
  const res = await fetch(`${PROXY_URL}/api/ticktick/project`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`Failed to fetch projects: ${res.status}`);
  return safeJson<Project[]>(res);
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
  const res = await fetch(
    `${PROXY_URL}/api/ticktick/project/${projectId}/data`,
    { headers: authHeaders(token) }
  );
  if (!res.ok) throw new Error(`Failed to fetch project data: ${res.status}`);
  return safeJson<ProjectData>(res);
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
  const res = await fetch(`${PROXY_URL}/api/ticktick/task`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(task),
  });
  if (!res.ok) throw new Error(`Failed to create task: ${res.status}`);
  return safeJson<Task>(res);
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
  const res = await fetch(`${PROXY_URL}/api/ticktick/task/${taskId}`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error(`Failed to update task: ${res.status}`);
  return safeJson<Task>(res);
}

export async function deleteTask(
  token: string,
  projectId: string,
  taskId: string
): Promise<void> {
  const res = await fetch(
    `${PROXY_URL}/api/ticktick/task/${projectId}/${taskId}`,
    {
      method: 'DELETE',
      headers: authHeaders(token),
    }
  );
  if (!res.ok) throw new Error(`Failed to delete task: ${res.status}`);
}

export async function completeTask(
  token: string,
  projectId: string,
  taskId: string
): Promise<void> {
  const res = await fetch(
    `${PROXY_URL}/api/ticktick/project/${projectId}/task/${taskId}/complete`,
    {
      method: 'POST',
      headers: authHeaders(token),
    }
  );
  if (!res.ok) throw new Error(`Failed to complete task: ${res.status}`);
}
