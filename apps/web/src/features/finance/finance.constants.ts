export const REFUND_STATUS_NAMES: Record<string, string> = {
  PENDING: 'Chờ xử lý',
  SUCCEEDED: 'Đã ghi nhận chi',
  FAILED: 'Không thành công',
  CANCELLED: 'Đã hủy',
  EXPIRED: 'Hết hạn',
};

export const WITHDRAWAL_STATUS_NAMES: Record<string, string> = {
  PENDING: 'Chờ duyệt',
  APPROVED: 'Chờ chuyển tiền',
  PAID: 'Đã ghi nhận chuyển tiền',
  REJECTED: 'Đã từ chối',
};

export const WALLET_ACCOUNT_NAMES: Record<string, string> = {
  SELLER_PENDING: 'Tiền đang chờ',
  SELLER_AVAILABLE: 'Tiền có thể rút',
};

export const WALLET_REFERENCE_NAMES: Record<string, string> = {
  ORDER: 'Bán hàng',
  SETTLEMENT: 'Kết chuyển tiền',
  WITHDRAWAL: 'Rút tiền',
  REFUND: 'Hoàn tiền',
};

export const RECONCILIATION_LABELS: Record<string, string> = {
  MISSING_IN_DB: 'Sao kê có, hệ thống chưa có',
  MISSING_IN_STATEMENT: 'Hệ thống có, sao kê chưa có',
  AMOUNT_MISMATCH: 'Số tiền chưa khớp',
};
