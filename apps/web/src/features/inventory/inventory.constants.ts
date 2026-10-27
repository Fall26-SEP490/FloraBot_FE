export const SLOT_STATUSES: Record<string, string> = {
  FREE: 'Chưa cho thuê',
  RENTED_EMPTY: 'Sẵn sàng nạp hoa',
  STOCKED: 'Đã nạp hoa',
  HELD: 'Khách đang thanh toán',
  PENDING_REMOVAL: 'Chờ lấy hoa hết hạn',
  PENDING_RELEASE: 'Chờ lấy hoa về để trả ô',
  FAULT: 'Có sự cố',
  LOCKED: 'Đang khóa',
};

export const ACCESSORY_KIOSK_STATUSES: Record<string, string> = {
  ONLINE: 'Tủ đang trực tuyến',
  OFFLINE: 'Tủ đang mất kết nối',
  MAINTENANCE: 'Tủ đang bảo trì',
};
