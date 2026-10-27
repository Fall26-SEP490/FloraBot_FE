import { request } from '../../api';
import type {
  AdminComplaintDetail,
  AdminComplaintPage,
  ResolveDisputeRequest,
} from './complaints.types';

export async function fetchAdminComplaints(
  status: string,
  page: number,
): Promise<AdminComplaintPage> {
  return request<AdminComplaintPage>(`/admin/complaints?status=${status}&page=${page}`);
}

export async function fetchAdminComplaintDetail(id: string): Promise<AdminComplaintDetail> {
  return request<AdminComplaintDetail>(`/admin/complaints/${id}`);
}

export async function resolveDispute(payload: ResolveDisputeRequest): Promise<void> {
  return request('/admin/flows/resolve_dispute', payload);
}
