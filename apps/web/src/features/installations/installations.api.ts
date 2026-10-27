import type { components } from '../../../../../packages/contracts/src/generated/api';
import { request } from '../../api';
import type {
  EligibleKioskResponse,
  EnrollKioskResponse,
  KioskApplicationDetailResponse,
  KioskApplicationPage,
  ProvisionKioskKeyResponse,
  StaffEvidenceItem,
  TechnicianInstallationDetail,
  TechnicianInstallationSummary,
} from './installations.types';

// Operations installation APIs
export async function fetchOperationsQueue(query: string): Promise<KioskApplicationPage> {
  return request<KioskApplicationPage>(`/operations/kiosk-applications${query}`);
}

export async function fetchOperationsApplicationDetail(
  appId: string,
): Promise<KioskApplicationDetailResponse> {
  return request<KioskApplicationDetailResponse>(`/operations/kiosk-applications/${appId}`);
}

export async function scheduleKioskInstallation(
  payload: components['schemas']['ScheduleKioskApplicationRequest'],
): Promise<unknown> {
  return request('/operations/flows/schedule_kiosk_application', payload);
}

export async function confirmKioskApplication(
  payload: components['schemas']['ConfirmKioskApplicationRequest'],
): Promise<unknown> {
  return request('/operations/flows/confirm_kiosk_application', payload);
}

export async function reworkKioskApplication(
  payload: components['schemas']['ReworkKioskApplicationRequest'],
): Promise<unknown> {
  return request('/operations/flows/rework_kiosk_application', payload);
}

export async function rejectKioskApplication(
  payload: components['schemas']['RejectKioskApplicationRequest'],
): Promise<unknown> {
  return request('/operations/flows/reject_kiosk_application', payload);
}

export async function reportPlatformFailure(
  payload: components['schemas']['PlatformFailureRequest'],
): Promise<unknown> {
  return request('/operations/flows/platform_failure', payload);
}

export async function fetchEligibleKiosks(): Promise<EligibleKioskResponse[]> {
  return request<EligibleKioskResponse[]>('/operations/kiosks/eligible');
}

export async function enrollKiosk(
  payload: components['schemas']['EnrollKioskRequest'],
): Promise<EnrollKioskResponse> {
  return request<EnrollKioskResponse>('/operations/flows/enroll_kiosk', payload);
}

export async function provisionKioskKey(kioskId: string): Promise<ProvisionKioskKeyResponse> {
  return request<ProvisionKioskKeyResponse>(
    `/operations/kiosks/${kioskId}/provision-key`,
    undefined,
    true,
    'POST',
  );
}

// Technician installation APIs
export async function fetchTechnicianJobs(): Promise<TechnicianInstallationSummary[]> {
  return request<TechnicianInstallationSummary[]>('/staff/kiosk-installations');
}

export async function fetchTechnicianJobDetail(
  jobId: string,
): Promise<TechnicianInstallationDetail> {
  return request<TechnicianInstallationDetail>(`/staff/kiosk-installations/${jobId}`);
}

export async function fetchJobEvidence(jobId: string): Promise<StaffEvidenceItem[]> {
  return request<StaffEvidenceItem[]>(`/staff/kiosk-installations/${jobId}/evidence`);
}

export async function submitInstallationReport(
  payload: components['schemas']['SubmitInstallationReportRequest'],
): Promise<unknown> {
  return request('/staff/flows/submit_installation_report', payload);
}
