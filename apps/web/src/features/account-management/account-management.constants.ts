export const accountStatuses = ['ACTIVE', 'LOCKED', 'DISABLED'] as const;

export const roleLabels: Record<string, string> = {
  ADMIN: 'Admin',
  OPERATIONS_MANAGER: 'Quản lý vận hành',
  TECHNICIAN: 'Kỹ thuật viên',
  SELLER: 'Chủ shop',
  SELLER_STAFF: 'Nhân viên shop',
  CUSTOMER: 'Khách hàng',
};

export const statusLabels: Record<string, string> = {
  ACTIVE: 'Đang hoạt động',
  LOCKED: 'Tạm khóa',
  DISABLED: 'Vô hiệu hóa',
  PENDING: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  PAST_DUE: 'Gói hết hạn',
  SUSPENDED: 'Tạm ngừng shop',
  CLOSED: 'Đã đóng shop',
};

export const phonePattern = /^(0[35789][0-9]{8}|\+84[35789][0-9]{8})$/;
export const emailPattern = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
