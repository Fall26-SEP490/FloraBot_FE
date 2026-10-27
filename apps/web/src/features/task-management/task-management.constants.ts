export const TASK_STATUS_LABELS: Record<string, string> = {
  ASSIGNED: 'Chờ bắt đầu',
  IN_PROGRESS: 'Đang thực hiện',
  SUBMITTED: 'Chờ duyệt báo cáo',
  COMPLETED: 'Đã duyệt',
  CANCELLED: 'Đã hủy',
};

export const TASK_DETAIL_STATES: Record<string, string> = {
  ONLINE: 'Đang kết nối',
  OFFLINE: 'Mất kết nối',
  MAINTENANCE: 'Đang bảo trì',
  DISABLED: 'Ngừng hoạt động',
  OPEN: 'Chưa giải quyết',
  RESOLVED_FIXED: 'Đã xử lý',
  ASSIGNED: 'Chờ bắt đầu',
  IN_PROGRESS: 'Đang thực hiện',
  SUBMITTED: 'Chờ duyệt báo cáo',
  COMPLETED: 'Đã duyệt',
  CANCELLED: 'Đã hủy',
  FREE: 'Chưa phân bổ',
  RENTED_EMPTY: 'Đang trống',
  STOCKED: 'Có hoa',
  RESERVED: 'Đang giữ hoa',
  DISPENSING: 'Đang nhận hoa',
  FAULT: 'Có sự cố',
  PENDING_RELEASE: 'Chờ thu hồi',
};

export const TASK_DETAIL_ACTIONS: Record<string, string> = {
  STAFF_TASK_ASSIGNED: 'Phân công công việc',
  STAFF_TASK_UPDATED: 'Cập nhật công việc',
  STAFF_TASK_STOCKED: 'Ghi nhận nạp hoa',
  STAFF_TASK_REASSIGNED: 'Bàn giao người phụ trách',
  STAFF_TASK_EVIDENCE_ADDED: 'Thêm ảnh minh chứng',
  STAFF_INCIDENT_RESOLVED: 'Ghi nhận sửa sự cố và gửi báo cáo',
};
