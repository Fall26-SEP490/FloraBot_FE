import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  Button,
  CheckCircle2,
  ClipboardList,
  RefreshCw,
} from '@florabot/ui';
import { request } from '@/shared/lib/api';
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
  const [status, setStatus] = useState(() =>
    role === 'OPERATIONS_MANAGER' &&
    props.initialStatus &&
    Object.hasOwn(TASK_STATUS_LABELS, props.initialStatus)
      ? props.initialStatus
      : '',
  );
  const [reload, setReload] = useState(0);
  const scopeKey = sellerId ? `seller:${sellerId}` : apiBase;
  const tasks = useQuery({
    queryKey: ['staff-tasks', role ?? 'none', actorId ?? 'none', scopeKey, page, status],
    queryFn: () => request<TaskPage>(`${apiBase}?page=${page}${status ? `&status=${status}` : ''}`),
    enabled: isValidRole,
    refetchInterval: (query) =>
      role === 'SELLER' &&
      query.state.data?.items.some(
        (task) => task.status === 'ASSIGNED' || task.status === 'IN_PROGRESS',
      )
        ? 10_000
        : false,
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
          ? 'Theo dõi công việc toàn hệ thống ở chế độ chỉ đọc. Quản lý vận hành và chủ shop phụ trách cập nhật hướng dẫn, phân công và duyệt báo cáo.'
          : role === 'TECHNICIAN'
            ? 'Bắt đầu công việc, ghi nhận kết quả và gửi báo cáo để Quản lý vận hành duyệt.'
            : 'Bắt đầu công việc, nạp hoa vào ô tủ và gửi báo cáo để chủ shop theo dõi.';

  return (
    <section
      id="staff-tasks"
      className={
        isPlatform ? 'platform-task-panel' : role === 'SELLER' ? 'seller-task-panel' : undefined
      }
      aria-labelledby="staff-tasks-title"
    >
      <h2
        id="staff-tasks-title"
        className={
          role === 'OPERATIONS_MANAGER' || role === 'TECHNICIAN' || role === 'SELLER_STAFF'
            ? 'sr-only'
            : undefined
        }
      >
        {sectionTitle}
      </h2>
      {role !== 'OPERATIONS_MANAGER' && role !== 'TECHNICIAN' && role !== 'SELLER_STAFF' && (
        <p>{sectionDescription}</p>
      )}
      {tasks.data &&
        role !== 'SELLER' &&
        role !== 'OPERATIONS_MANAGER' &&
        role !== 'TECHNICIAN' && (
          <div className="operations-metrics order-summary-strip" aria-label="Thống kê công việc">
            <div className="operations-metric">
              <ClipboardList aria-hidden="true" />
              <span>Tổng công việc</span>
              <strong>{tasks.data.items.length}</strong>
              <small>Trong trang đang xem</small>
            </div>
            <div className="operations-metric">
              <RefreshCw aria-hidden="true" style={{ color: '#0369a1' }} />
              <span>Chờ bắt đầu hoặc đang thực hiện</span>
              <strong style={{ color: '#0369a1' }}>
                {
                  tasks.data.items.filter(
                    (t) => t.status === 'IN_PROGRESS' || t.status === 'ASSIGNED',
                  ).length
                }
              </strong>
            </div>
            <div className="operations-metric">
              <CheckCircle2 aria-hidden="true" style={{ color: '#16a34a' }} />
              <span>Chờ duyệt hoặc đã duyệt</span>
              <strong style={{ color: 'var(--color-status-success-ink)' }}>
                {
                  tasks.data.items.filter(
                    (t) => t.status === 'SUBMITTED' || t.status === 'COMPLETED',
                  ).length
                }
              </strong>
            </div>
          </div>
        )}
      {(role === 'SELLER' || role === 'OPERATIONS_MANAGER' || role === 'TECHNICIAN') &&
        tasks.isSuccess && (
          <p
            className={role === 'SELLER' ? 'seller-task-count' : 'manager-task-count'}
            role="status"
          >
            {tasks.data.items.length} công việc trong trang {page}
            {status ? ` · ${TASK_STATUS_LABELS[status] || status}` : ''}.
            {tasks.data.hasMore ? ' Còn công việc ở trang sau.' : ''}
          </p>
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
          <label
            htmlFor="task-status"
            className={
              role === 'SELLER' || role === 'OPERATIONS_MANAGER' || role === 'TECHNICIAN'
                ? undefined
                : 'sr-only'
            }
          >
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
      ) : !tasks.data ? (
        <p role="alert">Chưa tải được công việc. Kiểm tra kết nối và thử tải lại.</p>
      ) : (
        <>
          {tasks.isError && (
            <p role="status">Chưa tải được công việc mới nhất. Đang hiển thị danh sách đã tải.</p>
          )}
          {tasks.data.items.length === 0 ? (
            <div className="operations-empty">
              <ClipboardList size={36} aria-hidden="true" />
              <h3>Chưa có công việc</h3>
              <p>
                {role === 'OPERATIONS_MANAGER'
                  ? status
                    ? 'Thử chọn trạng thái khác để xem công việc.'
                    : 'Mở Phân công công việc mới để chọn sự cố và người xử lý.'
                  : 'Chưa có công việc trong danh sách này.'}
              </p>
              {role === 'SELLER' && (
                <p>
                  {status || page > 1
                    ? 'Thử bỏ lọc trạng thái hoặc quay về trang đầu.'
                    : 'Mở “Phân công công việc mới” để chọn nhân viên và tủ giao hoa.'}{' '}
                  <Link href="/seller/staff">Quản lý nhân viên shop</Link>
                </p>
              )}
              {isPlatform && role !== 'OPERATIONS_MANAGER' && (
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
                key={`${task.id}-${role === 'TECHNICIAN' ? task.status : task.version}-${reload}`}
                task={task}
                mode={mode}
                role={role}
                actorId={actorId}
                sellerId={sellerId}
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
