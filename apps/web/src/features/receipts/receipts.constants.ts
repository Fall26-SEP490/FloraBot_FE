export const RECEIPT_STORAGE_KEY = 'florabot-personal-receipts-v1';

export const RECEIPT_STATUSES: Record<string, string> = {
  AWAITING_PAYMENT: 'Đang chờ thanh toán',
  PAID: 'Đã thanh toán',
  DISPENSING: 'Tủ đang giao hoa',
  COMPLETED: 'Đã nhận hoa',
  DISPENSE_FAILED: 'Giao hoa chưa thành công',
  DISPUTED: 'Đang xử lý phản ánh',
  REFUNDED: 'Đã hoàn tiền',
  CANCELLED: 'Đã hủy',
  EXPIRED: 'Đã hết hạn',
};
