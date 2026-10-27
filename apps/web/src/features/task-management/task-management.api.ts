import { request } from '../../api';
import type {
  DeliveryScope,
  IncidentCandidate,
  StaffDirectoryMember,
  TaskAssignmentPayload,
  TaskDetail,
  TaskEvidencePage,
  TaskPage,
} from './task-management.types';

export async function fetchTasks(
  apiBase: string,
  page: number,
  status?: string,
): Promise<TaskPage> {
  return request<TaskPage>(`${apiBase}?page=${page}${status ? `&status=${status}` : ''}`);
}

export async function transitionTask(
  apiBase: string,
  taskId: string,
  values: { report: string; status: string; version: number },
): Promise<void> {
  return request(`${apiBase}/${taskId}/transition`, values);
}

export async function fetchTaskDetails(
  apiBase: string,
  taskId: string,
  page: number,
): Promise<TaskDetail> {
  return request<TaskDetail>(`${apiBase}/${taskId}?page=${page}`);
}

export async function fetchTaskEvidence(
  apiBase: string,
  taskId: string,
  page: number,
): Promise<TaskEvidencePage> {
  return request<TaskEvidencePage>(`${apiBase}/${taskId}/evidence?page=${page}`);
}

export async function submitTaskEvidence(
  path: string,
  payload: { version: number; reference: string },
): Promise<void> {
  return request(path, payload);
}

export async function reassignTask(
  apiBase: string,
  taskId: string,
  payload: { assigneeId: string; reason: string; version: number },
): Promise<void> {
  return request(`${apiBase}/${taskId}/reassign`, payload);
}

export async function assignTask(apiBase: string, payload: TaskAssignmentPayload): Promise<void> {
  return request(apiBase, payload);
}

export async function fetchStaffDirectory(endpoint: string): Promise<StaffDirectoryMember[]> {
  return request<StaffDirectoryMember[]>(endpoint);
}

export async function fetchIncidents(endpoint: string): Promise<IncidentCandidate[]> {
  return request<IncidentCandidate[]>(endpoint);
}

export async function fetchDeliveryScopes(endpoint: string): Promise<DeliveryScope[]> {
  return request<DeliveryScope[]>(endpoint);
}
