export interface Task {
  id: string;
  projectId: string;
  columnId?: string;
  title: string;
  content?: string;
  status: number; // 0=open, 2=completed
  priority: number; // 0=none, 1=low, 3=medium, 5=high
  tags?: string[];
  parentId?: string;
  sortOrder?: number;
  startDate?: string;
  dueDate?: string;
  timeZone?: string;
  items?: ChecklistItem[];
}

export interface ChecklistItem {
  id: string;
  title: string;
  status: number;
  sortOrder: number;
}

export interface Project {
  id: string;
  name: string;
  color?: string;
  sortOrder?: number;
  viewMode?: string;
  kind?: string;
}

export interface Section {
  id: string;
  projectId: string;
  name: string;
  sortOrder: number;
}

export interface BatchCheckResponse {
  projectProfiles: Project[];
  syncTaskBean: {
    update: Task[];
  };
  [key: string]: unknown;
}
