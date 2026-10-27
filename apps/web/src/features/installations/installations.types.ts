import type { components } from '../../../../../packages/contracts/src/generated/api';

export type KioskApplicationStatus =
  | 'AWAITING_PAYMENT'
  | 'PAID_REVIEW'
  | 'UNDER_REVIEW'
  | 'CONFIRMED'
  | 'SCHEDULED'
  | 'INSTALLING'
  | 'AWAITING_HANDOVER'
  | 'ACTIVE'
  | 'CANCELLED'
  | 'REJECTED'
  | 'REFUND_PENDING'
  | 'REFUNDED';

// Generated OpenAPI Schemas (25 DTOs)
export type KioskPackageResponse = components['schemas']['KioskPackageResponse'];
export type KioskPackage = KioskPackageResponse;

export type CreateKioskApplicationRequest = components['schemas']['CreateKioskApplicationRequest'];
export type KioskApplicationResponse = components['schemas']['KioskApplicationResponse'];
export type PaymentLinkResponse = components['schemas']['PaymentLinkResponse'];

export type CancelKioskApplicationRequest = components['schemas']['CancelKioskApplicationRequest'];
export type CancelApplicationRequest = CancelKioskApplicationRequest;

export type KioskApplicationDetailResponse =
  components['schemas']['KioskApplicationDetailResponse'];
export type OperationsKioskApplicationDetail = KioskApplicationDetailResponse;

export type EvidenceUploadResponse = components['schemas']['EvidenceUploadResponse'];

export type KioskApplicationPage = components['schemas']['KioskApplicationPage'];
export type OperationsKioskApplicationPage = KioskApplicationPage;

export type EligibleKioskResponse = components['schemas']['EligibleKioskResponse'];
export type EligibleKioskItem = EligibleKioskResponse;

export type EnrollKioskRequest = components['schemas']['EnrollKioskRequest'];

export type ConfirmKioskApplicationRequest =
  components['schemas']['ConfirmKioskApplicationRequest'];
export type ConfirmApplicationRequest = ConfirmKioskApplicationRequest;

export type ScheduleKioskApplicationRequest =
  components['schemas']['ScheduleKioskApplicationRequest'];
export type ScheduleInstallationRequest = ScheduleKioskApplicationRequest;

export type ReworkKioskApplicationRequest = components['schemas']['ReworkKioskApplicationRequest'];
export type ReworkApplicationRequest = ReworkKioskApplicationRequest;

export type RejectKioskApplicationRequest = components['schemas']['RejectKioskApplicationRequest'];
export type RejectApplicationRequest = RejectKioskApplicationRequest;

export type PlatformFailureRequest = components['schemas']['PlatformFailureRequest'];

export type TechnicianInstallationSummary = components['schemas']['TechnicianInstallationSummary'];
export type TechnicianInstallationItem = TechnicianInstallationSummary;

export type TechnicianInstallationDetail = components['schemas']['TechnicianInstallationDetail'];

export type StaffEvidenceItem = components['schemas']['StaffEvidenceItem'];
export type IncidentPhoto = components['schemas']['IncidentPhoto'];
export type InstallationEvidenceItem = IncidentPhoto;

export type SubmitInstallationReportRequest =
  components['schemas']['SubmitInstallationReportRequest'];

export type AdminKioskRefundSummary = components['schemas']['AdminKioskRefundSummary'];
export type AdminKioskRefundItem = AdminKioskRefundSummary;

export type KioskRefundBankResponse = components['schemas']['KioskRefundBankResponse'];
export type AdminKioskBankDetailsResponse = KioskRefundBankResponse;

export type EnrollKioskResponse = components['schemas']['EnrollKioskResponse'];
export type ProvisionKioskKeyResponse = components['schemas']['ProvisionKioskKeyResponse'];
export type ConfirmKioskRefundRequest = components['schemas']['ConfirmKioskRefundRequest'];

export interface ProvisionedKeyInfo {
  kioskId: string;
  code: string;
  apiKey: string;
}

export type StageTabValue = 'ALL' | 'PAID_REVIEW' | 'CONFIRMED' | 'AWAITING_HANDOVER';
