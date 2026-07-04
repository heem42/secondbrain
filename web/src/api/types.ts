// Mirrors the NestJS API JSON (camelCase). See ARCHITECTURE.md §5.

export type TaskStatus = 'todo' | 'in_progress' | 'done';
export type TaskPriority = 'none' | 'low' | 'medium' | 'high';

export interface User {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl?: string | null;
}

export interface TaskList {
  id: string;
  ownerId: string;
  groupId: string | null;
  name: string;
  color: string | null;
  isInbox: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  listId: string;
  createdBy: string | null;
  title: string;
  notes: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueAt: string | null;
  remindAt: string | null;
  recurrenceRule: string | null;
  completedAt: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}
