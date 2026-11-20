import WorkspaceTable from '@/features/portal/components/WorkspaceTable';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@florabot/ui';
import { request } from '@/shared/lib/api';
import { TASK_DETAIL_ACTIONS, TASK_DETAIL_STATES } from '../task-management.constants';
import type { StaffTaskDetailsProps, TaskDetail } from '../task-management.types';
import { formatTaskDate } from '../task-management.utils';
import TechnicianIoTHealth from './TechnicianIoTHealth';

export type { StaffTaskDetailsProps };

export function staffTaskDetailsQuery(
  taskId: string,
  apiBase: string,
  scopeKey: string,
  actorId: string | undefined,
  version: number,
  page = 1,
) {
  return {
    queryKey: ['staff-detail', taskId, actorId ?? 'none', scopeKey, version, page],
    queryFn: () => request<TaskDetail>(`${apiBase}/${taskId}?page=${page}`),
  };
}

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
    ...staffTaskDetailsQuery(taskId, apiBase, scopeKey, actorId, version, page),
    enabled: open,
    refetchInterval: open ? 30_000 : false,
  });
  return (
    <details className="staff-task-details" onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>Thông tin tủ, sự cố và lịch sử công việc</summary>
      {open && role === 'TECHNICIAN' && (
        <TechnicianIoTHealth path={`/staff/tasks/${taskId}/iot-health`} actorId={actorId} />
      )}
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
              <dd>{TASK_DETAIL_STATES[details.data.kioskStatus] || details.data.kioskStatus}</dd>
            </div>
            <div>
              <dt>Tín hiệu gần nhất</dt>
              <dd>
                {details.data.lastHeartbeatAt
                  ? formatTaskDate(details.data.lastHeartbeatAt)
                  : 'Chưa có tín hiệu được ghi nhận'}
              </dd>
            </div>
            {details.data.slotCode && (
              <div>
                <dt>Ô liên quan</dt>
                <dd>
                  {details.data.slotCode} ·{' '}
                  {TASK_DETAIL_STATES[details.data.slotStatus || ''] || details.data.slotStatus}
                </dd>
              </div>
            )}
          </dl>
          {details.data.slotObservation && (
            <section aria-label="Ghi nhận cửa và hoa của ô">
              <h4>Ghi nhận cửa và hoa · {details.data.slotObservation.slotCode}</h4>
              <p>
                Thời điểm bản đo:{' '}
                {details.data.slotObservedAt
                  ? formatTaskDate(details.data.slotObservedAt)
                  : 'Chưa có thời điểm ghi nhận'}
              </p>
              <dl className="account-details">
                <div>
                  <dt>Cảm biến hoa</dt>
                  <dd>
                    {details.data.slotObservation.hasFlowers == null
                      ? 'Chưa xác định'
                      : details.data.slotObservation.hasFlowers
                        ? 'Phát hiện vật trong ô'
                        : 'Không phát hiện vật trong ô'}
                  </dd>
                </div>
                <div>
                  <dt>Cửa đã mở lúc</dt>
                  <dd>
                    {details.data.slotObservation.latestUnlock?.doorOpenedAt
                      ? formatTaskDate(details.data.slotObservation.latestUnlock.doorOpenedAt)
                      : 'Chưa có ghi nhận mở cửa'}
                  </dd>
                </div>
                <div>
                  <dt>Cửa đã đóng lúc</dt>
                  <dd>
                    {details.data.slotObservation.latestUnlock?.doorClosedAt
                      ? formatTaskDate(details.data.slotObservation.latestUnlock.doorClosedAt)
                      : 'Chưa có ghi nhận đóng cửa'}
                  </dd>
                </div>
              </dl>
            </section>
          )}
          {details.data.incident && (
            <section aria-label="Nội dung sự cố">
              <h4>
                {details.data.incident.kind === 'DISPENSE_FAILED'
                  ? 'Nhận hoa không thành công'
                  : 'Sự cố thiết bị'}
              </h4>
              <p>
                {TASK_DETAIL_STATES[details.data.incident.status] || details.data.incident.status} ·{' '}
                {formatTaskDate(details.data.incident.createdAt)}
              </p>
              <p>{details.data.incident.reason}</p>
              {details.data.incident.decision && (
                <p>Kết quả xử lý: {details.data.incident.decision}</p>
              )}
              {role !== 'ADMIN' && role !== 'TECHNICIAN' && role !== 'OPERATIONS_MANAGER' && (
                <p>Gửi báo cáo để chủ shop theo dõi.</p>
              )}
            </section>
          )}
          <h4>Lịch sử công việc</h4>
          {details.data.history.length === 0 ? (
            <p>Chưa có lịch sử ở trang này.</p>
          ) : role === 'ADMIN' || role === 'TECHNICIAN' || role === 'OPERATIONS_MANAGER' ? (
            <WorkspaceTable label="Lịch sử công việc">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Thời gian</th>
                    <th scope="col">Hoạt động</th>
                    <th scope="col">Người thực hiện</th>
                    <th scope="col">Nội dung</th>
                  </tr>
                </thead>
                <tbody>
                  {details.data.history.map((event) => (
                    <tr key={event.id}>
                      <td>
                        <time dateTime={event.createdAt}>{formatTaskDate(event.createdAt)}</time>
                      </td>
                      <td>
                        <strong>{TASK_DETAIL_ACTIONS[event.action] || event.action}</strong>
                        {event.toStatus && (
                          <span className="table-secondary">
                            {event.fromStatus
                              ? `${TASK_DETAIL_STATES[event.fromStatus] || event.fromStatus} → `
                              : ''}
                            {TASK_DETAIL_STATES[event.toStatus] || event.toStatus}
                          </span>
                        )}
                      </td>
                      <td>{event.actorName || '—'}</td>
                      <td>
                        {event.report ? (
                          event.report.length > 160 ? (
                            <details>
                              <summary>Xem báo cáo</summary>
                              <p>{event.report}</p>
                            </details>
                          ) : (
                            event.report
                          )
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </WorkspaceTable>
          ) : (
            <ol className="staff-task-history">
              {details.data.history.map((event) => (
                <li key={event.id}>
                  <p>
                    <strong>{TASK_DETAIL_ACTIONS[event.action] || event.action}</strong> ·{' '}
                    {event.actorName}
                  </p>
                  <time dateTime={event.createdAt}>{formatTaskDate(event.createdAt)}</time>
                  {event.toStatus && (
                    <p>
                      {event.fromStatus
                        ? `${TASK_DETAIL_STATES[event.fromStatus] || event.fromStatus} → `
                        : ''}
                      {TASK_DETAIL_STATES[event.toStatus] || event.toStatus}
                    </p>
                  )}
                  {event.report && <p>{event.report}</p>}
                </li>
              ))}
            </ol>
          )}
          <div className="staff-history-pagination" aria-label="Phân trang lịch sử công việc">
            {(page > 1 || details.data.hasMore) && (
              <>
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
              </>
            )}
          </div>
        </>
      )}
    </details>
  );
}
