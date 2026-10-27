import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  Button,
  CheckCircle2,
  ClipboardList,
  RefreshCw,
} from '@florabot/ui';
import { request } from '../../api';
import AdminTaskAssignment from './components/AdminTaskAssignment';
import { TaskItem } from './components/TaskItem';
import { TASK_STATUS_LABELS } from './task-management.constants';
import type { ActiveTaskRole, StaffTasksProps, TaskPage } from './task-management.types';
import './styles/task-management.css';

export type { ActiveTaskRole, StaffTasksProps };

export function TaskManagement(props: StaffTasksProps) {
  const role = props.actorRole ?? props.role ?? (props.admin ? 'ADMIN' : undefined);
  const isValidRole = Boolean(
    role && ['ADMIN', 'OPERATIONS_MANAGER', 'TECHNICIAN', 'SELLER', 'SELLER_STAFF'].includes(role),
  );

  const mode = props.mode ?? (props.admin ? 'oversight' : 'worker');
  const actorId = props.actorId ?? props.staffId ?? props.adminId;
  const sellerId = props.sellerId ?? null;
  const isManagement = mode === 'manager' || mode === 'oversight';
  const isPlatform = role === 'ADMIN' || role === 'OPERATIONS_MANAGER' || role === 'TECHNICIAN';
  const readOnly = props.readOnly ?? (mode === 'oversight' && role === 'ADMIN');

  const apiBase = props.apiBase ?? (isManagement ? '/admin/staff-tasks' : '/staff/tasks');
  const directoryEndpoint = props.directoryEndpoint ?? '/admin/staff';
  const incidentsEndpoint = props.incidentsEndpoint ?? '/admin/incidents';
  const deliveryScopesEndpoint = props.deliveryScopesEndpoint ?? '/admin/staff-delivery-scopes';

  const canAssign = Boolean(props.canAssign ?? (mode === 'manager' || (props.admin && !readOnly)));
  const canReassign = Boolean(
    props.canReassign ?? (mode === 'manager' || (props.admin && !readOnly)),
  );

  const allowedKinds =
    props.allowedKinds ??
    (role === 'TECHNICIAN' || role === 'OPERATIONS_MANAGER'
      ? ['INCIDENT']
      : role === 'SELLER_STAFF' || role === 'SELLER'
        ? ['DELIVERY']
        : ['INCIDENT', 'DELIVERY']);

  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [reload, setReload] = useState(0);
  const scopeKey = sellerId ? `seller:${sellerId}` : apiBase;
  const tasks = useQuery({
    queryKey: ['staff-tasks', role ?? 'none', actorId ?? 'none', scopeKey, page, status],
    queryFn: () => request<TaskPage>(`${apiBase}?page=${page}${status ? `&status=${status}` : ''}`),
    enabled: isValidRole,
  });

  if (!isValidRole || !role) {
    return (
      <section id="staff-tasks" aria-labelledby="staff-tasks-title">
        <h2 id="staff-tasks-title">Công việc</h2>
        <p role="alert">Quyền truy cập công việc không hợp lệ hoặc đã ngừng hoạt động.</p>
      </section>
    );
  }

  const sectionTitle =
    role === 'OPERATIONS_MANAGER'
      ? 'Công việc kỹ thuật'
      : role === 'SELLER'
        ? 'Phân công giao hoa'
        : role === 'ADMIN'
          ? 'Theo dõi công việc'
          : role === 'TECHNICIAN'
            ? 'Công việc kỹ thuật'
            : 'Công việc giao hoa';

  const sectionDescription =
    role === 'OPERATIONS_MANAGER'
      ? 'Phân công sự cố cho kỹ thuật viên và kiểm tra báo cáo khắc phục lỗi tủ.'
      : role === 'SELLER'
        ? 'Phân công giao hoa cho nhân viên shop và theo dõi tiến độ nạp hoa tại tủ.'
        : role === 'ADMIN'
          ? 'Theo dõi trạng thái công việc toàn hệ thống ở chế độ chỉ đọc. Việc phân công và duyệt báo cáo do Quản lý vận hành và chủ shop thực hiện.'
          : role === 'TECHNICIAN'
            ? 'Bắt đầu công việc, ghi nhận kết quả và gửi báo cáo để Quản lý vận hành duyệt.'
            : 'Bắt đầu công việc, nạp hoa vào ô tủ và gửi báo cáo để chủ shop theo dõi.';

  return (
    <section
      id="staff-tasks"
      className={isPlatform ? 'platform-task-panel' : undefined}
      aria-labelledby="staff-tasks-title"
    >
      <h2 id="staff-tasks-title">{sectionTitle}</h2>
      <p>{sectionDescription}</p>
      {tasks.data && (
        <div className="operations-metrics order-summary-strip" aria-label="Thống kê công việc">
          <div className="operations-metric">
            <ClipboardList aria-hidden="true" />
            <span>Tổng công việc</span>
            <strong>{tasks.data.items.length}</strong>
            <small>{isPlatform ? 'Trong trang đang xem' : 'Trong danh sách'}</small>
          </div>
          <div className="operations-metric">
            <RefreshCw aria-hidden="true" style={{ color: '#0369a1' }} />
            <span>Đang thực hiện</span>
            <strong style={{ color: '#0369a1' }}>
              {
                tasks.data.items.filter(
                  (t) => t.status === 'IN_PROGRESS' || t.status === 'ASSIGNED',
                ).length
              }
            </strong>
            <small>Chờ hoặc đang làm</small>
          </div>
          <div className="operations-metric">
            <CheckCircle2 aria-hidden="true" style={{ color: '#16a34a' }} />
            <span>{isPlatform ? 'Đã gửi / Hoàn tất' : 'Đã duyệt / Hoàn tất'}</span>
            <strong style={{ color: 'var(--color-status-success-ink)' }}>
              {
                tasks.data.items.filter((t) => t.status === 'SUBMITTED' || t.status === 'COMPLETED')
                  .length
              }
            </strong>
            <small>Đã gửi báo cáo</small>
          </div>
        </div>
      )}
      {canAssign && actorId && (
        <AdminTaskAssignment
          actorId={actorId}
          apiBase={apiBase}
          role={role}
          allowedKinds={allowedKinds}
          directoryEndpoint={directoryEndpoint}
          incidentsEndpoint={incidentsEndpoint}
          deliveryScopesEndpoint={deliveryScopesEndpoint}
          sellerId={sellerId}
        />
      )}
      <div className="staff-task-toolbar">
        <div>
          <label htmlFor="task-status" className="sr-only">
            Lọc trạng thái
          </label>
          <select
            id="task-status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
          >
            <option value="">Tất cả trạng thái</option>
            {Object.entries(TASK_STATUS_LABELS).map(([value, text]) => (
              <option key={value} value={value}>
                {text}
              </option>
            ))}
          </select>
        </div>
        <Button
          variant="outline"
          disabled={tasks.isFetching}
          onClick={async () => {
            const result = await tasks.refetch();
            if (!result.isError) setReload((value) => value + 1);
          }}
        >
          <RefreshCw size={15} aria-hidden="true" className={tasks.isFetching ? 'spin' : ''} />
          Tải lại công việc
        </Button>
      </div>
      {tasks.isPending ? (
        <p role="status">Đang tải công việc…</p>
      ) : tasks.isError ? (
        <p role="alert">Chưa tải được công việc. Kiểm tra kết nối và thử tải lại.</p>
      ) : (
        <>
          {tasks.data.items.length === 0 ? (
            <div className="operations-empty">
              <ClipboardList size={36} aria-hidden="true" />
              <h3>Chưa có công việc</h3>
              <p>Chưa có công việc trong danh sách này.</p>
              {isPlatform && (
                <p className="platform-empty-hint">
                  {status || page > 1
                    ? 'Thử đổi bộ lọc hoặc quay về trang đầu để xem các công việc khác.'
                    : role === 'TECHNICIAN'
                      ? 'Khi được quản lý phân công, thông tin địa điểm, hướng dẫn và tiến độ sẽ xuất hiện tại đây.'
                      : 'Các công việc được ghi nhận và phân công sẽ xuất hiện tại đây để theo dõi.'}
                </p>
              )}
            </div>
          ) : (
            tasks.data.items.map((task) => (
              <TaskItem
                key={`${task.id}-${task.version}-${reload}`}
                task={task}
                mode={mode}
                role={role}
                actorId={actorId}
                apiBase={apiBase}
                directoryEndpoint={directoryEndpoint}
                canReassign={canReassign}
                readOnly={readOnly}
              />
            ))
          )}
          {(tasks.data.items.length > 0 || page > 1) && (
            <nav aria-label="Phân trang công việc" className="order-pagination">
              <Button
                variant="outline"
                disabled={page === 1 || tasks.isFetching}
                onClick={() => setPage(page - 1)}
              >
                <ArrowLeft size={16} aria-hidden="true" />
                <span>Trang trước</span>
              </Button>
              <span className="order-pagination-indicator" aria-live="polite">
                Trang {page}
              </span>
              <Button
                variant="outline"
                disabled={!tasks.data.hasMore || tasks.isFetching}
                onClick={() => setPage(page + 1)}
              >
                <span>Trang sau</span>
                <ArrowRight size={16} aria-hidden="true" />
              </Button>
            </nav>
          )}
        </>
      )}
    </section>
  );
}

export const StaffTasks = TaskManagement;
export default TaskManagement;
