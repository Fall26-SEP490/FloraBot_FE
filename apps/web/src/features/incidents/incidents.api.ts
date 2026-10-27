import { request } from '../../api';
import type {
  AdminIncidentDetail,
  AdminIncidentPage,
  FlowResult,
  ReportDeviceFaultRequest,
  ResolveDeviceFaultRequest,
  StaffIncidentResolutionAttempt,
} from './incidents.types';

export async function fetchAdminIncidents(
  status: string,
  page: number,
): Promise<AdminIncidentPage> {
  return request<AdminIncidentPage>(`/admin/incidents?status=${status}&page=${page}`);
}

export async function fetchAdminIncidentDetail(id: string): Promise<AdminIncidentDetail> {
  return request<AdminIncidentDetail>(`/admin/incidents/${id}`);
}

export async function resolveDeviceFault(payload: ResolveDeviceFaultRequest): Promise<void> {
  return request('/admin/flows/resolve_device_fault', payload);
}

export async function resolveStaffIncident(
  apiBase: string,
  taskId: string,
  payload: StaffIncidentResolutionAttempt,
): Promise<void> {
  return request(`${apiBase}/${taskId}/resolve-incident`, payload);
}

export async function reportDeviceFault(
  sellerId: string,
  payload: ReportDeviceFaultRequest,
): Promise<FlowResult> {
  return request<FlowResult>(`/sellers/${sellerId}/flows/report_device_fault`, payload);
}
