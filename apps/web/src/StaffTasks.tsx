import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import {
  ArrowLeft,
  ArrowRight,
  Button,
  CheckCircle2,
  ClipboardList,
  RefreshCw,
} from '@florabot/ui';
import { ApiError, queryClient, request } from './api';
import AdminTaskAssignment from './AdminTaskAssignment';
import StaffStock from './features/inventory/StaffStock';
import StaffTaskDetails from './StaffTaskDetails';
import StaffReassignment from './StaffReassignment';
import StaffEvidence from './StaffEvidence';
import StaffIncidentResolution from './StaffIncidentResolution';

type Task = {
  id: string;
  kind: string;
  status: string;
  version: number;
  assigneeName: string;
  assigneeId: string;
  kioskName: string;
  address: string;
  shopName: string | null;
  instructions: string;
  report: string | null;
};
type Page = { items: Task[]; page: number; hasMore: boolean };
const labels: Record<string, string> = {
  ASSIGNED: 'Chờ bắt đầu',
  IN_PROGRESS: 'Đang thực hiện',
  SUBMITTED: 'Chờ duyệt báo cáo',
  COMPLETED: 'Đã duyệt',
  CANCELLED: 'Đã hủy',
};

export type ActiveTaskRole =
  'ADMIN' | 'OPERATIONS_MANAGER' | 'TECHNICIAN' | 'SELLER' | 'SELLER_STAFF';

function TaskItem({
  task,
  mode,
  role,
  actorId,
  sellerId,
  apiBase,
  directoryEndpoint,
  canReassign,
  readOnly,
}: {
  task: Task;
  mode: 'worker' | 'manager' | 'oversight';
  role: ActiveTaskRole;
  actorId?: string;
  sellerId?: string | null;
  apiBase: string;
  directoryEndpoint?: string;
  canReassign: boolean;
  readOnly: boolean;
}) {
  const isWorker = mode === 'worker';
  const isManager = mode === 'manager';
  const form = useForm<{ report: string; status: string }>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [uncertain, setUncertain] = useState(false);
  const [notice, setNotice] = useState('');
  const choices = readOnly
    ? []
    : isManager
      ? task.status === 'SUBMITTED'
        ? ['COMPLETED', 'IN_PROGRESS', 'CANCELLED']
        : ['ASSIGNED', 'IN_PROGRESS'].includes(task.status)
          ? ['CANCELLED']
          : []
      : isWorker
        ? task.status === 'ASSIGNED'
          ? ['IN_PROGRESS']
          : task.status === 'IN_PROGRESS'
            ? ['SUBMITTED']
            : []
        : [];
  async function submit(values: { report: string; status: string }) {
    if (busy || uncertain) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await request(`${apiBase}/${task.id}/transition`, { ...values, version: task.version });
      form.reset();
      setNotice('Đã cập nhật công việc.');
      await queryClient.invalidateQueries({ queryKey: ['staff-tasks'] });
    } catch (cause) {
      const ambiguous = !(cause instanceof ApiError) || cause.status >= 500 || cause.status === 409;
      setUncertain(ambiguous);
      setError(
        ambiguous
          ? 'Chưa xác nhận được trạng thái mới. Tải lại danh sách để kiểm tra trước khi thao tác tiếp.'
          : cause.message,
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="member-empty" aria-labelledby={`task-${task.id}`}>
      <div className="staff-task-heading">
        <h3 id={`task-${task.id}`}>
          {task.kind === 'INCIDENT' ? 'Kiểm tra sự cố' : 'Giao hoa'} · {task.kioskName}
        </h3>
        <span className="staff-task-label">{labels[task.status] || task.status}</span>
      </div>
      <p>Người thực hiện: {task.assigneeName}</p>
      <p>
        {task.address}
        {task.shopName ? ` · ${task.shopName}` : ''}
      </p>
      <p>{task.instructions}</p>
      <StaffTaskDetails
        taskId={task.id}
        version={task.version}
        apiBase={apiBase}
        admin={!isWorker}
        readOnly={readOnly}
        actorId={actorId}
        sellerId={sellerId}
        role={role}
      />
      <StaffEvidence
        key={`${task.id}:${task.version}:${actorId}`}
        taskId={task.id}
        version={task.version}
        apiBase={apiBase}
        actorId={actorId}
        sellerId={sellerId}
        role={role}
        mode={mode}
        admin={!isWorker}
        active={isWorker && task.status === 'IN_PROGRESS'}
      />
      {canReassign && ['ASSIGNED', 'IN_PROGRESS'].includes(task.status) && (
        <StaffReassignment
          taskId={task.id}
          version={task.version}
          assigneeId={task.assigneeId}
          assigneeName={task.assigneeName}
          apiBase={apiBase}
          directoryEndpoint={directoryEndpoint}
          actorId={actorId}
          sellerId={sellerId}
          role={role}
        />
      )}
      {task.report && (
        <p>
          <strong>Báo cáo gần nhất:</strong> {task.report}
        </p>
      )}
      {isWorker && role === 'SELLER_STAFF' && actorId && task.kind === 'DELIVERY' && (
        <StaffStock
          taskId={task.id}
          actorId={actorId}
          sellerId={sellerId}
          role={role}
          active={task.status === 'IN_PROGRESS'}
          apiBase={apiBase}
        />
      )}
      {isWorker && role === 'TECHNICIAN' && actorId && task.kind === 'INCIDENT' && (
        <StaffIncidentResolution
          taskId={task.id}
          actorId={actorId}
          sellerId={sellerId}
          role={role}
          version={task.version}
          active={task.status === 'IN_PROGRESS'}
          apiBase={apiBase}
        />
      )}
      {choices.length > 0 && (
        <form noValidate onSubmit={form.handleSubmit(submit)}>
          <label htmlFor={`action-${task.id}`}>Bước tiếp theo</label>
          <select
            id={`action-${task.id}`}
            {...form.register('status', { required: true })}
            disabled={busy || uncertain}
          >
            {choices.map((choice) => (
              <option key={choice} value={choice}>
                {choice === 'IN_PROGRESS' && isManager ? 'Yêu cầu kiểm tra lại' : labels[choice]}
              </option>
            ))}
          </select>
          <label htmlFor={`report-${task.id}`}>Nội dung cập nhật</label>
          <textarea
            id={`report-${task.id}`}
            maxLength={2000}
            rows={3}
            {...form.register('report', {
              validate: (value) => value.trim().length >= 10 || 'Mô tả ít nhất 10 ký tự.',
            })}
            aria-invalid={!!form.formState.errors.report}
            aria-describedby={`report-error-${task.id}`}
            disabled={busy}
          />
          <p id={`report-error-${task.id}`} className="error">
            {form.formState.errors.report?.message}
          </p>
          <Button type="submit" disabled={busy || uncertain}>
            {busy ? 'Đang cập nhật…' : 'Xác nhận cập nhật'}
          </Button>
        </form>
      )}
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
    </article>
  );
}

export type StaffTasksProps = {
  actorRole?: ActiveTaskRole;
  role?: ActiveTaskRole;
  mode?: 'worker' | 'manager' | 'oversight';
  actorId?: string;
  sellerId?: string | null;
  apiBase?: string;
  directoryEndpoint?: string;
  incidentsEndpoint?: string;
  deliveryScopesEndpoint?: string;
  allowedKinds?: ('INCIDENT' | 'DELIVERY')[];
  canAssign?: boolean;
  canReassign?: boolean;
  readOnly?: boolean;
  admin?: boolean;
  adminId?: string;
  staffId?: string;
};

export default function StaffTasks(props: StaffTasksProps) {
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
    queryFn: () => request<Page>(`${apiBase}?page=${page}${status ? `&status=${status}` : ''}`),
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
            {Object.entries(labels).map(([value, text]) => (
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
