import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@florabot/ui';
import { request } from './api';

import type { ActiveTaskRole } from './StaffTasks';

type Detail = {
  kioskStatus: string;
  lastHeartbeatAt: string | null;
  incident: {
    kind: string;
    status: string;
    reason: string;
    decision: string | null;
    createdAt: string;
  } | null;
  slotCode: string | null;
  slotStatus: string | null;
  history: {
    id: string;
    actorName: string;
    action: string;
    fromStatus: string | null;
    toStatus: string | null;
    report: string | null;
    createdAt: string;
  }[];
  page: number;
  hasMore: boolean;
};
const states: Record<string, string> = {
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
const actions: Record<string, string> = {
  STAFF_TASK_ASSIGNED: 'Phân công công việc',
  STAFF_TASK_UPDATED: 'Cập nhật công việc',
  STAFF_TASK_STOCKED: 'Ghi nhận nạp hoa',
  STAFF_TASK_REASSIGNED: 'Bàn giao người phụ trách',
  STAFF_TASK_EVIDENCE_ADDED: 'Thêm ảnh minh chứng',
  STAFF_INCIDENT_RESOLVED: 'Ghi nhận sửa sự cố và gửi báo cáo',
};
const date = (value: string) => new Date(value).toLocaleString('vi-VN');

export type StaffTaskDetailsProps = {
  taskId: string;
  version: number;
  admin?: boolean;
  apiBase?: string;
  actorId?: string;
  sellerId?: string | null;
  role?: ActiveTaskRole;
  readOnly?: boolean;
};

export default function StaffTaskDetails({
  taskId,
  version,
  admin = false,
  apiBase: explicitApiBase,
  actorId,
  sellerId,
  role,
}: StaffTaskDetailsProps) {
  const apiBase = explicitApiBase ?? (admin ? '/admin/staff-tasks' : '/staff/tasks');
  const scopeKey = sellerId ? `seller:${sellerId}` : apiBase;
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const details = useQuery({
    queryKey: ['staff-detail', taskId, actorId ?? 'none', scopeKey, version, page],
    queryFn: () => request<Detail>(`${apiBase}/${taskId}?page=${page}`),
    enabled: open,
  });
  return (
    <details className="staff-task-details" onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>Thông tin tủ, sự cố và lịch sử công việc</summary>
      {details.isPending ? (
        <p role="status">Đang tải thông tin công việc…</p>
      ) : details.isError ? (
        <>
          <p role="alert">
            Chưa tải được chi tiết. Công việc có thể đã thay đổi hoặc kết nối bị gián đoạn.
          </p>
          <Button onClick={() => void details.refetch()}>Thử tải lại chi tiết</Button>
        </>
      ) : (
        <>
          <dl className="account-details">
            <div>
              <dt>Tình trạng tủ</dt>
              <dd>{states[details.data.kioskStatus] || details.data.kioskStatus}</dd>
            </div>
            <div>
              <dt>Tín hiệu gần nhất</dt>
              <dd>
                {details.data.lastHeartbeatAt
                  ? date(details.data.lastHeartbeatAt)
                  : 'Chưa có tín hiệu được ghi nhận'}
              </dd>
            </div>
            {details.data.slotCode && (
              <div>
                <dt>Ô liên quan</dt>
                <dd>
                  {details.data.slotCode} ·{' '}
                  {states[details.data.slotStatus || ''] || details.data.slotStatus}
                </dd>
              </div>
            )}
          </dl>
          {details.data.incident && (
            <section aria-label="Nội dung sự cố">
              <h4>
                {details.data.incident.kind === 'DISPENSE_FAILED'
                  ? 'Nhận hoa không thành công'
                  : 'Sự cố thiết bị'}
              </h4>
              <p>
                {states[details.data.incident.status] || details.data.incident.status} ·{' '}
                {date(details.data.incident.createdAt)}
              </p>
              <p>{details.data.incident.reason}</p>
              {details.data.incident.decision && (
                <p>Kết quả xử lý: {details.data.incident.decision}</p>
              )}
              <p>
                {role === 'TECHNICIAN' || role === 'OPERATIONS_MANAGER'
                  ? 'Gửi báo cáo công việc để Quản lý vận hành xem xét. Báo cáo không tự hoàn tiền hoặc mở cửa tủ.'
                  : 'Gửi báo cáo công việc để chủ shop theo dõi. Báo cáo không tự cập nhật tồn kho mở bán.'}
              </p>
            </section>
          )}
          <h4>Lịch sử công việc</h4>
          {details.data.history.length === 0 ? (
            <p>Chưa có lịch sử ở trang này.</p>
          ) : (
            <ol className="staff-task-history">
              {details.data.history.map((event) => (
                <li key={event.id}>
                  <p>
                    <strong>{actions[event.action] || event.action}</strong> · {event.actorName}
                  </p>
                  <time dateTime={event.createdAt}>{date(event.createdAt)}</time>
                  {event.toStatus && (
                    <p>
                      {event.fromStatus ? `${states[event.fromStatus] || event.fromStatus} → ` : ''}
                      {states[event.toStatus] || event.toStatus}
                    </p>
                  )}
                  {event.report && <p>{event.report}</p>}
                </li>
              ))}
            </ol>
          )}
          <div className="staff-history-pagination" aria-label="Phân trang lịch sử công việc">
            <Button
              variant="outline"
              disabled={page === 1 || details.isFetching}
              onClick={() => setPage(page - 1)}
            >
              Lịch sử trước
            </Button>
            <span>Trang {page}</span>
            <Button
              variant="outline"
              disabled={!details.data.hasMore || details.isFetching}
              onClick={() => setPage(page + 1)}
            >
              Lịch sử tiếp
            </Button>
            <Button
              variant="outline"
              disabled={details.isFetching}
              onClick={() => void details.refetch()}
            >
              Cập nhật chi tiết
            </Button>
          </div>
        </>
      )}
    </details>
  );
}
