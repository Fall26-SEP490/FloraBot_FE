import type { AdminIncidentResponse, StaffIncidentResolutionAttempt } from './incidents.types';

export function formatIncidentDate(value: string): string {
  return new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
}

export function formatIncidentLabel(
  row: Pick<AdminIncidentResponse, 'location' | 'kioskId' | 'slot'>,
): string {
  return `${row.location?.kioskName || row.kioskId}${row.slot ? ` · Ô ${row.slot.slotCode}` : ' · Toàn kiosk'}`;
}

export function safeUrl(value: string): string | null {
  try {
    if (
      /^\/api\/admin\/evidence\/[0-9a-f-]{36}$/i.test(value) ||
      /^\/api\/admin\/incidents\/[0-9a-f-]{36}\/evidence\/[0-9a-f-]{36}$/i.test(value)
    )
      return value;
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

export function restoreIncidentResolutionAttempt(
  key: string,
): StaffIncidentResolutionAttempt | null {
  try {
    const value = JSON.parse(
      sessionStorage.getItem(key) || 'null',
    ) as StaffIncidentResolutionAttempt | null;
    return value &&
      typeof value.id === 'string' &&
      Number.isInteger(value.version) &&
      typeof value.report === 'string'
      ? value
      : null;
  } catch {
    return null;
  }
}

export function incidentProgressLabel(
  row: Pick<AdminIncidentResponse, 'status' | 'progress' | 'task'>,
): string {
  if (row.status === 'RESOLVED_FIXED') return 'Đã giải quyết';
  const progress =
    row.progress ?? (row.task?.status === 'SUBMITTED' ? 'AWAITING_REVIEW' : row.task?.status);
  if (progress === 'COMPLETED') return 'Việc đã xong · Phiếu chưa đóng';
  if (progress === 'AWAITING_REVIEW') return 'Chờ nghiệm thu';
  if (progress === 'ASSIGNED' || row.task?.status === 'ASSIGNED') return 'Đã phân công';
  if (progress === 'IN_PROGRESS') return 'Đang xử lý';
  if (progress === 'UNASSIGNED') return 'Chưa phân công';
  return 'Chưa đóng';
}

export function incidentResolutionError(
  error: { status: number; code?: string; message: string },
  slotRepair: boolean,
): string {
  if (
    error.status === 409 &&
    slotRepair &&
    !error.code?.startsWith('REPAIR_') &&
    error.code !== 'TASK_VERSION_CONFLICT'
  ) {
    return 'Hệ thống chưa chấp nhận báo cáo sửa ô. Cần kiểm tra trạng thái công việc, quyền sửa, chu kỳ cửa và cảm biến trước khi gửi lại.';
  }
  return error.message;
}
