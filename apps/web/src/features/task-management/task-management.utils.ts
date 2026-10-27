import type {
  TaskAssignmentPayload,
  TaskEvidenceAttempt,
  TaskReassignAttempt,
} from './task-management.types';

export function restoreEvidenceAttempt(key: string): TaskEvidenceAttempt | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(key) || 'null') as TaskEvidenceAttempt | null;
    return value &&
      typeof value.id === 'string' &&
      Number.isInteger(value.version) &&
      typeof value.reference === 'string' &&
      value.reference.startsWith('evidence:v1:')
      ? value
      : null;
  } catch {
    return null;
  }
}

export function restoreReassignAttempt(key: string): TaskReassignAttempt | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(key) || 'null') as TaskReassignAttempt | null;
    return value &&
      Number.isInteger(value.version) &&
      typeof value.assigneeId === 'string' &&
      typeof value.reason === 'string'
      ? value
      : null;
  } catch {
    return null;
  }
}

export function restoreAssignmentPayload(key: string): TaskAssignmentPayload | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(key) || 'null') as TaskAssignmentPayload | null;
    return value &&
      typeof value.id === 'string' &&
      typeof value.assigneeId === 'string' &&
      typeof value.kioskId === 'string' &&
      typeof value.instructions === 'string' &&
      ['INCIDENT', 'DELIVERY'].includes(value.kind)
      ? value
      : null;
  } catch {
    return null;
  }
}

export function getEvidenceStorageKey(
  actorId?: string,
  scopeKey?: string,
  taskId?: string,
): string {
  return `florabot-staff-evidence:${actorId ?? 'none'}:${scopeKey}:${taskId}`;
}

export function getReassignStorageKey(
  role?: string,
  actorId?: string,
  scopeKey?: string,
  taskId?: string,
): string {
  return `florabot-staff-reassign:${role ?? 'none'}:${actorId ?? 'none'}:${scopeKey}:${taskId}`;
}

export function getAssignmentStorageKey(
  actorId?: string,
  role?: string,
  scopeKey?: string,
): string {
  return `florabot-task-assign:${actorId ?? 'none'}:${role ?? 'none'}:${scopeKey}`;
}

export function formatTaskDate(value: string): string {
  return new Date(value).toLocaleString('vi-VN');
}
