export const KIOSK_STATUS_LABELS: Record<string, string> = {
  AWAITING_PAYMENT: 'Chờ thanh toán phí thuê',
  PAID_REVIEW: 'Đã thanh toán - Chờ duyệt',
  UNDER_REVIEW: 'Đang xem xét',
  CONFIRMED: 'Đã xác nhận - Chờ xếp lịch',
  SCHEDULED: 'Đã xếp lịch lắp đặt',
  INSTALLING: 'Đang lắp đặt tại điểm',
  AWAITING_HANDOVER: 'Chờ nghiệm thu bàn giao',
  ACTIVE: 'Đã bàn giao',
  CANCELLED: 'Đã hủy',
  REJECTED: 'Đã từ chối',
  REFUND_PENDING: 'Đang xử lý hoàn tiền',
  REFUNDED: 'Đã hoàn tiền',
};

export const DEFAULT_TIME_WINDOW = '09:00 - 12:00';

export const TIME_WINDOW_REGEX = /^([01]\d|2[0-3]):[0-5]\d - ([01]\d|2[0-3]):[0-5]\d$/;

export const MAX_EVIDENCE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export const ALLOWED_IMAGE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;

export const OPERATIONS_STAGE_TABS = [
  ['ALL', 'Tất cả'],
  ['PAID_REVIEW', 'Chờ xác nhận'],
  ['CONFIRMED', 'Chờ xếp lịch'],
  ['AWAITING_HANDOVER', 'Chờ nghiệm thu'],
] as const;

export const OPERATIONS_PROGRESS_STEPS = [
  'Xác nhận liên hệ',
  'Xếp lịch lắp đặt',
  'Nghiệm thu',
  'Bàn giao',
] as const;

export const TECHNICIAN_PROGRESS_STEPS = [
  'Được phân công',
  'Thực hiện',
  'Chờ nghiệm thu',
  'Hoàn tất',
] as const;

export const KIOSK_REGIONS = [
  { value: 'HCM', label: 'TP. Hồ Chí Minh (HCM)' },
  { value: 'HN', label: 'Hà Nội (HN)' },
  { value: 'DN', label: 'Đà Nẵng (DN)' },
] as const;
