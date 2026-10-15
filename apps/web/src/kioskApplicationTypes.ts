import type { components } from '../../../packages/contracts/src/generated/api';

/**
 * Annual Kiosk Onboarding Types & DTOs
 * Generated components schema aliases & UI constants.
 */

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

export const KIOSK_STATUS_LABELS: Record<string, string> = {
  AWAITING_PAYMENT: 'Chờ thanh toán phí thuê',
  PAID_REVIEW: 'Đã thanh toán - Chờ duyệt',
  UNDER_REVIEW: 'Đang xem xét',
  CONFIRMED: 'Đã xác nhận - Chờ xếp lịch',
  SCHEDULED: 'Đã xếp lịch lắp đặt',
  INSTALLING: 'Đang lắp đặt tại điểm',
  AWAITING_HANDOVER: 'Chờ nghiệm thu bàn giao',
  ACTIVE: 'Đang hoạt động (Chủ shop)',
  CANCELLED: 'Đã hủy',
  REJECTED: 'Đã từ chối',
  REFUND_PENDING: 'Đang xử lý hoàn tiền',
  REFUNDED: 'Đã hoàn tiền',
};

export const KIOSK_PACKAGE_DEFAULTS = [
  {
    name: 'Trial',
    annualFee: 10000,
    walkInSlots: 1,
    preorderSlots: 1,
    totalSlots: 2,
    termMonths: 12,
    description: 'Gói trải nghiệm 1 năm: 1 ô vãng lai (Walk-in) + 1 ô đặt trước (Pre-order)',
  },
  {
    name: 'Pro',
    annualFee: 15000,
    walkInSlots: 4,
    preorderSlots: 4,
    totalSlots: 8,
    termMonths: 12,
    description: 'Gói chuyên nghiệp 1 năm: 4 ô vãng lai (Walk-in) + 4 ô đặt trước (Pre-order)',
  },
  {
    name: 'Max',
    annualFee: 20000,
    walkInSlots: 6,
    preorderSlots: 6,
    totalSlots: 12,
    termMonths: 12,
    description: 'Gói tối đa 1 năm: 6 ô vãng lai (Walk-in) + 6 ô đặt trước (Pre-order)',
  },
] as const;

export function validatePayosCheckoutUrl(rawUrl: string): {
  valid: boolean;
  url?: string;
  error?: string;
} {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { valid: false, error: 'Địa chỉ thanh toán không hợp lệ.' };
  }
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return { valid: false, error: 'Địa chỉ thanh toán không được để trống.' };
  }
  try {
    const parsed = new URL(trimmed);

    // Reject userinfo unconditionally (e.g. https://user:pass@pay.payos.vn)
    if (parsed.username || parsed.password) {
      return {
        valid: false,
        error: 'Địa chỉ thanh toán chứa thông tin xác thực người dùng không an toàn.',
      };
    }

    // Production security constraint: EXACT https: and EXACT pay.payos.vn host
    if (parsed.protocol !== 'https:') {
      return { valid: false, error: 'Chỉ chấp nhận liên kết thanh toán HTTPS bảo mật.' };
    }
    if (parsed.hostname !== 'pay.payos.vn') {
      return {
        valid: false,
        error: 'Tên miền không thuộc cổng thanh toán payOS được ủy quyền (yêu cầu pay.payos.vn).',
      };
    }
    if (parsed.port && parsed.port !== '443') {
      return { valid: false, error: 'Cổng kết nối không tiêu chuẩn bị từ chối.' };
    }

    return { valid: true, url: parsed.toString() };
  } catch {
    return { valid: false, error: 'Định dạng liên kết thanh toán không hợp lệ.' };
  }
}

export function parseAndValidateCoordinate(
  input: string,
  kind: 'lat' | 'lon',
): { valid: boolean; value: number | null; error?: string } {
  const trimmed = input.trim();
  if (!trimmed) {
    return {
      valid: false,
      value: null,
      error: 'Tọa độ không được để trống (ô trống không đồng nghĩa với 0).',
    };
  }
  const num = Number(trimmed);
  if (!Number.isFinite(num)) {
    return { valid: false, value: null, error: 'Tọa độ phải là một số hợp lệ.' };
  }
  if (kind === 'lat') {
    if (num < -90 || num > 90) {
      return { valid: false, value: null, error: 'Vĩ độ phải nằm trong khoảng từ -90 đến 90.' };
    }
  } else {
    if (num < -180 || num > 180) {
      return { valid: false, value: null, error: 'Kinh độ phải nằm trong khoảng từ -180 đến 180.' };
    }
  }
  return { valid: true, value: num };
}
