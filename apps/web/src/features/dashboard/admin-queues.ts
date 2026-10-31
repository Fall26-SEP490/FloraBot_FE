export const adminQueues = [
  {
    key: 'refunds',
    title: 'Hoàn tiền đơn hoa',
    endpoint: '/admin/refunds?status=PENDING&page=1',
    description:
      'Kiểm tra khoản hoàn. Người duyệt và người xác nhận chi phải là hai quản trị viên khác nhau.',
    action: 'Xử lý hoàn tiền đơn hoa',
    group: 'review',
  },
  {
    key: 'kiosk-refunds',
    title: 'Hoàn tiền thuê kiosk',
    endpoint: '/admin/kiosk-applications/refunds',
    description: 'Kiểm tra hồ sơ hoàn phí thuê và chứng từ trước khi xác nhận chi.',
    action: 'Xử lý hoàn tiền thuê kiosk',
    group: 'review',
  },
  {
    key: 'withdrawals',
    title: 'Yêu cầu rút tiền của shop',
    endpoint: '/admin/withdrawals?status=PENDING&page=1',
    description: 'Kiểm tra yêu cầu, duyệt hoặc từ chối và ghi nhận khoản đã chuyển.',
    action: 'Xử lý rút tiền',
    group: 'review',
  },
  {
    key: 'complaints',
    title: 'Phản ánh của khách',
    endpoint: '/admin/complaints?status=OPEN&page=1',
    description: 'Đọc bằng chứng và quyết định cách xử lý phản ánh của khách hàng.',
    action: 'Xử lý phản ánh',
    group: 'review',
  },
  {
    key: 'shops',
    title: 'Hồ sơ shop chờ duyệt',
    endpoint: '/admin/sellers?status=PENDING',
    description:
      'Duyệt gói cho shop đã có hồ sơ trong hệ thống. Hồ sơ thuê kiosk mới do Quản lý vận hành xử lý.',
    action: 'Xem hồ sơ shop',
    group: 'review',
  },
  {
    key: 'incidents',
    title: 'Sự cố kiosk đang mở',
    endpoint: '/admin/incidents?status=OPEN&page=1',
    description:
      'Kiểm tra bằng chứng và ghi nhận kết quả xử lý sự cố. Quản lý vận hành phân công kỹ thuật viên.',
    action: 'Xem sự cố kiosk',
    group: 'monitor',
  },
  {
    key: 'installations',
    title: 'Hồ sơ thuê kiosk mới',
    endpoint: '/operations/kiosk-applications?status=PAID_REVIEW&page=1&limit=10',
    description:
      'Khách thuê đã thanh toán. Quản lý vận hành xác nhận liên hệ, xếp lịch và bàn giao.',
    action: 'Theo dõi hồ sơ thuê',
    group: 'monitor',
  },
] as const;

export type AdminQueue = (typeof adminQueues)[number];
export type QueueSnapshot = { count: number; hasMore: boolean };

export function readQueue(value: unknown): QueueSnapshot {
  if (Array.isArray(value)) return { count: value.length, hasMore: false };
  if (value && typeof value === 'object' && 'items' in value && Array.isArray(value.items)) {
    return { count: value.items.length, hasMore: 'hasMore' in value && value.hasMore === true };
  }
  throw new Error('Không đọc được danh sách yêu cầu.');
}

export function queueCountLabel(snapshot: QueueSnapshot) {
  return `${snapshot.count}${snapshot.hasMore ? '+' : ''}`;
}
