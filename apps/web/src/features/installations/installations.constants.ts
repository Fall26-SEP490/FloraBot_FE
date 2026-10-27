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
