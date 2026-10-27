export const ORDER_STATES: Record<string, string> = {
  AWAITING_PAYMENT: 'Chờ thanh toán',
  PAID: 'Shop đang chuẩn bị',
  DISPENSING: 'Đang nhận hoa tại tủ',
  COMPLETED: 'Đã nhận hoa',
  EXPIRED: 'Hết hạn thanh toán',
  CANCELLED: 'Đã hủy',
  DISPENSE_FAILED: 'Chờ xử lý hoàn tiền',
  REFUNDED: 'Đã hoàn tiền',
  DISPUTED: 'Đang xử lý phản ánh',
};

export const REQUEST_STATES: Record<string, string> = {
  REQUESTED: 'Chờ shop báo giá',
  QUOTED: 'Đã có báo giá',
  REJECTED: 'Shop chưa thể nhận đơn',
  CANCELLED: 'Đã hủy',
  ORDERED: 'Đã tạo đơn',
};
