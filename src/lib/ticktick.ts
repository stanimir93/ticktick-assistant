import type { BatchCheckResponse, Section } from '../types';

const PROXY_URL = import.meta.env.VITE_PROXY_URL || '';

function deviceHeader(): string {
  return JSON.stringify({
    platform: 'web',
    os: 'macOS',
    device: 'Chrome',
    name: '',
    version: 4576,
    id: crypto.randomUUID().replace(/-/g, '').slice(0, 24),
    channel: 'website',
    campaign: '',
    websocket: '',
  });
}

function headers(token: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'x-device': deviceHeader(),
    Cookie: `t=${token}`,
  };
}

export async function login(
  email: string,
  password: string
): Promise<{ token: string }> {
  const res = await fetch(
    `${PROXY_URL}/api/ticktick/user/signon?wc=true&remember=true`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-device': deviceHeader(),
      },
      body: JSON.stringify({ username: email, password }),
    }
  );
  const data = await res.json();
  if (!res.ok || data.errorCode) {
    throw new Error(data.errorMessage || data.errorCode || `Login failed: ${res.status}`);
  }
  return { token: data.token };
}

export async function getAllData(token: string): Promise<BatchCheckResponse> {
  const res = await fetch(`${PROXY_URL}/api/ticktick/batch/check/0`, {
    method: 'GET',
    headers: headers(token),
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch data: ${res.status}`);
  }
  return res.json();
}

export async function getProjectSections(
  token: string,
  projectId: string
): Promise<Section[]> {
  const res = await fetch(
    `${PROXY_URL}/api/ticktick/column/project/${projectId}`,
    {
      method: 'GET',
      headers: headers(token),
    }
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch sections: ${res.status}`);
  }
  const data = await res.json();
  return data.columns ?? data ?? [];
}

export async function batchTaskUpdate(
  token: string,
  payload: {
    add?: unknown[];
    update?: unknown[];
    delete?: unknown[];
  }
): Promise<unknown> {
  const res = await fetch(`${PROXY_URL}/api/ticktick/batch/task`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Batch task update failed: ${res.status}`);
  }
  return res.json();
}

export async function moveTaskToProject(
  token: string,
  payload: Array<{
    taskId: string;
    fromProjectId: string;
    toProjectId: string;
  }>
): Promise<unknown> {
  const res = await fetch(`${PROXY_URL}/api/ticktick/batch/taskProject`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Move task failed: ${res.status}`);
  }
  return res.json();
}
