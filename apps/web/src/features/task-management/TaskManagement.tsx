import WorkspaceTable from '@/features/portal/components/WorkspaceTable';
import { Modal } from '@/shared/components/Modal';
import { useCallback, useRef, useState } from 'react';
import IconActionButton from '@/shared/components/IconActionButton';
import Select from '@/shared/components/Select';
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
import StaffTaskBoard from './components/StaffTaskBoard';
import { TaskItem } from './components/TaskItem';
import { TASK_STATUS_LABELS } from './task-management.constants';
import type { ActiveTaskRole, StaffTasksProps, TaskPage } from './task-management.types';
import './styles/task-management.css';
import '../account-management/styles/seller-team.css';
import './styles/operational-detail-polish.css';

export type { ActiveTaskRole, StaffTasksProps };

export function TaskManagement(props: StaffTasksProps) {
  const role = props.actorRole ?? props.role;
  const mode = props.mode ?? (props.admin ? 'oversight' : 'worker');
  if (role === 'SELLER_STAFF' && mode === 'worker') {
    const actorId = props.actorId ?? props.staffId;
    return (
      <StaffTaskBoard
        key={`${actorId}:${props.sellerId}:${props.apiBase}`}
        actorId={actorId}
        sellerId={props.sellerId}
        apiBase={props.apiBase ?? '/staff/tasks'}
        readOnly={props.readOnly ?? false}
      />
    );
  }
  return <FilteredTaskList {...props} />;
}

function FilteredTaskList(props: StaffTasksProps) {
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
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [selectedAdminTask, setSelectedAdminTask] = useState<string | null>(null);
  const [openTaskIds, setOpenTaskIds] = useState<Set<string>>(() => new Set());
  const handleTaskOpen = useCallback((id: string, open: boolean) => {
    setOpenTaskIds((previous) => {
      if (previous.has(id) === open) return previous;
      const next = new Set(previous);
      if (open) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);
  const [status, setStatus] = useState(() =>
    role === 'OPERATIONS_MANAGER' &&
    props.initialStatus &&
    Object.hasOwn(TASK_STATUS_LABELS, props.initialStatus)
      ? props.initialStatus
      : '',
  );
  const [taskSearch, setTaskSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const [reload, setReload] = useState(0);
  const [focusedTaskId, setFocusedTaskId] = useState<string | null>(null);
  const [transitionResult, setTransitionResult] = useState<{
    id: string;
    kioskName: string;
    status: string;
  } | null>(null);
  const [managerView, setManagerView] = useState<'incidents' | 'tasks' | 'review'>(
    props.initialStatus === 'SUBMITTED' ? 'review' : props.initialStatus ? 'tasks' : 'incidents',
  );
  const scopeKey = sellerId ? `seller:${sellerId}` : apiBase;
  const tasks = useQuery({
    meta: {
      portalManagedRefresh: isPlatform,
      portalRefreshPaused:
        (isPlatform || role === 'SELLER') &&
        (!!selectedAdminTask || assignmentOpen || openTaskIds.size > 0),
    },
    queryKey: ['staff-tasks', role ?? 'none', actorId ?? 'none', scopeKey, page, status],
    queryFn: () => request<TaskPage>(`${apiBase}?page=${page}${status ? `&status=${status}` : ''}`),
    enabled: isValidRole,
    refetchOnWindowFocus: !selectedAdminTask && openTaskIds.size === 0,
    refetchOnReconnect: !selectedAdminTask && openTaskIds.size === 0,
    refetchInterval: (query) =>
      selectedAdminTask || assignmentOpen
        ? false
        : role === 'ADMIN' || role === 'OPERATIONS_MANAGER' || role === 'TECHNICIAN'
          ? selectedAdminTask || openTaskIds.size > 0
            ? false
            : 30_000
          : role === 'SELLER' &&
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

  const normalizeSearch = (value: string) =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9]/g, '');
  const matchesSearch = (task: TaskPage['items'][number]) =>
    !(isPlatform || role === 'SELLER') ||
    normalizeSearch(
      `${task.kioskName} ${task.assigneeName} ${task.shopName || ''} ${task.id}`,
    ).includes(normalizeSearch(taskSearch.trim()));
  const matchedCount = tasks.data?.items.filter(matchesSearch).length ?? 0;

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
          ? 'Tiến độ và báo cáo công việc toàn hệ thống.'
          : role === 'TECHNICIAN'
            ? 'Bắt đầu công việc, ghi nhận kết quả và gửi báo cáo để Quản lý vận hành duyệt.'
            : 'Bắt đầu công việc, nạp hoa vào ô tủ và gửi báo cáo để chủ shop theo dõi.';

  return (
    <section
      id="staff-tasks"
      className={
        role === 'OPERATIONS_MANAGER'
          ? 'platform-task-panel manager-service-desk'
          : isPlatform
            ? 'platform-task-panel'
            : role === 'SELLER'
              ? 'seller-task-panel'
              : undefined
      }
      aria-labelledby="staff-tasks-title"
    >
      <h2
        id="staff-tasks-title"
        className={
          role === 'SELLER' ||
          role === 'ADMIN' ||
          role === 'OPERATIONS_MANAGER' ||
          role === 'TECHNICIAN' ||
          role === 'SELLER_STAFF'
            ? 'sr-only'
            : undefined
        }
      >
        {sectionTitle}
      </h2>
      {role !== 'SELLER' &&
        role !== 'ADMIN' &&
        role !== 'OPERATIONS_MANAGER' &&
        role !== 'TECHNICIAN' &&
        role !== 'SELLER_STAFF' && <p>{sectionDescription}</p>}
      {tasks.data &&
        role !== 'SELLER' &&
        role !== 'OPERATIONS_MANAGER' &&
        role !== 'TECHNICIAN' &&
        role !== 'SELLER_STAFF' && (
          <div className="operations-metrics order-summary-strip" aria-label="Thống kê công việc">
            <div className="operations-metric">
              <ClipboardList aria-hidden="true" />
              <span>Tổng công việc</span>
              <strong>{tasks.data.items.length}</strong>
              <small>Trong trang đang xem</small>
            </div>
            <div className="operations-metric operations-metric--info">
              <RefreshCw aria-hidden="true" />
              <span>Chờ bắt đầu hoặc đang thực hiện</span>
              <strong>
                {
                  tasks.data.items.filter(
                    (t) => t.status === 'IN_PROGRESS' || t.status === 'ASSIGNED',
                  ).length
                }
              </strong>
            </div>
            <div className="operations-metric operations-metric--success">
              <CheckCircle2 aria-hidden="true" />
              <span>Báo cáo đã gửi hoặc hoàn thành</span>
              <strong>
                {
                  tasks.data.items.filter(
                    (t) => t.status === 'SUBMITTED' || t.status === 'COMPLETED',
                  ).length
                }
              </strong>
            </div>
          </div>
        )}
      {role === 'OPERATIONS_MANAGER' && (
        <nav className="manager-desk-navigation" aria-label="Khu vực xử lý sự cố">
          {(
            [
              ['incidents', 'Sự cố', ClipboardList],
              ['tasks', 'Đã phân công', RefreshCw],
              ['review', 'Chờ nghiệm thu', CheckCircle2],
            ] as const
          ).map(([view, title, Icon]) => (
            <button
              key={view}
              type="button"
              aria-pressed={managerView === view}
              aria-controls={view === 'incidents' ? 'manager-incident-area' : 'manager-task-area'}
              onClick={() => {
                setManagerView(view);
                setStatus(view === 'review' ? 'SUBMITTED' : '');
                setPage(1);
              }}
            >
              <span className="manager-desk-nav-icon">
                <Icon size={20} aria-hidden="true" />
              </span>
              <span>
                <strong>{title}</strong>
              </span>
            </button>
          ))}
        </nav>
      )}
      {role === 'OPERATIONS_MANAGER' && transitionResult && (
        <div className="manager-transition-result" role="status">
          <div>
            <strong>
              {transitionResult.status === 'COMPLETED'
                ? 'Đã xác nhận hoàn thành'
                : 'Đã cập nhật công việc'}
            </strong>
            <p>
              {transitionResult.kioskName} ·{' '}
              {TASK_STATUS_LABELS[transitionResult.status] || transitionResult.status}
            </p>
          </div>
          {transitionResult.status === 'COMPLETED' && (
            <Button
              variant="outline"
              onClick={() => {
                setManagerView('tasks');
                setStatus('COMPLETED');
                setPage(1);
              }}
            >
              Xem công việc hoàn thành
            </Button>
          )}
          <button
            type="button"
            aria-label="Đóng thông báo kết quả công việc"
            className="icon-close-control"
            onClick={() => setTransitionResult(null)}
          >
            ×
          </button>
        </div>
      )}
      <div
        id="manager-incident-area"
        hidden={role === 'OPERATIONS_MANAGER' && managerView !== 'incidents'}
      >
        {canAssign &&
          actorId &&
          (role === 'SELLER' ? (
            <Modal
              open={assignmentOpen}
              title="Giao công việc"
              onClose={() => setAssignmentOpen(false)}
              className="seller-task-create-modal"
            >
              {assignmentOpen && (
                <AdminTaskAssignment
                  actorId={actorId}
                  linkedTasks={tasks.data?.items ?? []}
                  onOpenTask={(id) => {
                    setTaskSearch('');
                    setFocusedTaskId(id);
                    setManagerView('tasks');
                    setStatus('');
                    setPage(1);
                  }}
                  apiBase={apiBase}
                  role={role}
                  allowedKinds={allowedKinds}
                  directoryEndpoint={directoryEndpoint}
                  incidentsEndpoint={incidentsEndpoint}
                  deliveryScopesEndpoint={deliveryScopesEndpoint}
                  sellerId={sellerId}
                />
              )}
            </Modal>
          ) : (
            <AdminTaskAssignment
              actorId={actorId}
              linkedTasks={tasks.data?.items ?? []}
              onOpenTask={(id) => {
                setTaskSearch('');
                setFocusedTaskId(id);
                setManagerView('tasks');
                setStatus('');
                setPage(1);
              }}
              apiBase={apiBase}
              role={role}
              allowedKinds={allowedKinds}
              directoryEndpoint={directoryEndpoint}
              incidentsEndpoint={incidentsEndpoint}
              deliveryScopesEndpoint={deliveryScopesEndpoint}
              sellerId={sellerId}
            />
          ))}
      </div>
      {role === 'TECHNICIAN' && (
        <nav className="technician-status-nav" aria-label="Chọn trạng thái công việc">
          {[
            ['', 'Tất cả'],
            ['ASSIGNED', 'Cần bắt đầu'],
            ['IN_PROGRESS', 'Đang làm'],
            ['SUBMITTED', 'Chờ quản lý duyệt'],
            ['COMPLETED', 'Đã hoàn thành'],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={status === value}
              onClick={() => {
                setStatus(value);
                setPage(1);
              }}
            >
              {label}
            </button>
          ))}
        </nav>
      )}
      <div
        id="manager-task-area"
        hidden={role === 'OPERATIONS_MANAGER' && managerView === 'incidents'}
      >
        {role === 'OPERATIONS_MANAGER' && (
          <div className="operations-section-heading operations-assigned-heading">
            <div>
              <span className="operations-eyebrow">THEO DÕI & NGHIỆM THU</span>
              <h2>{managerView === 'review' ? 'Báo cáo chờ duyệt' : 'Công việc đã giao'}</h2>
            </div>
          </div>
        )}
        {isPlatform && (
          <div className="task-page-search">
            <label htmlFor="task-page-search">Tìm công việc trong trang</label>
            <input
              id="task-page-search"
              ref={searchRef}
              type="search"
              value={taskSearch}
              placeholder="Tên tủ, người phụ trách hoặc mã công việc"
              onChange={(event) => setTaskSearch(event.target.value)}
            />
            {taskSearch && (
              <Button
                variant="outline"
                onClick={() => {
                  setTaskSearch('');
                  searchRef.current?.focus({ preventScroll: true });
                }}
              >
                Xóa tìm kiếm
              </Button>
            )}
            {tasks.isSuccess && (
              <p role="status">
                {matchedCount} / {tasks.data.items.length} công việc trong trang {page}
                {tasks.data.hasMore ? ' · Còn trang tiếp theo' : ''}
              </p>
            )}
          </div>
        )}
        <div className="staff-task-toolbar">
          {role === 'SELLER' && (
            <div className="seller-task-search">
              <label htmlFor="seller-task-search">Tìm công việc</label>
              <input
                id="seller-task-search"
                type="search"
                value={taskSearch}
                placeholder="Kiosk, nhân viên hoặc mã công việc"
                onChange={(event) => setTaskSearch(event.target.value)}
              />
            </div>
          )}
          {role === 'SELLER' && canAssign && (
            <Button type="button" onClick={() => setAssignmentOpen(true)}>
              Giao việc mới
            </Button>
          )}
          <div
            hidden={
              role === 'TECHNICIAN' || (role === 'OPERATIONS_MANAGER' && managerView === 'review')
            }
          >
            <label
              htmlFor="task-status"
              className={
                role === 'SELLER' || role === 'OPERATIONS_MANAGER' || role === 'TECHNICIAN'
                  ? undefined
                  : 'sr-only'
              }
            >
              Trạng thái
            </label>
            <Select
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
            </Select>
          </div>
          {role === 'OPERATIONS_MANAGER' && managerView === 'tasks' && (
            <Button
              variant="outline"
              aria-pressed={status === 'COMPLETED'}
              onClick={() => {
                setStatus(status === 'COMPLETED' ? '' : 'COMPLETED');
                setPage(1);
              }}
            >
              Đã hoàn thành
            </Button>
          )}
          {(role === 'SELLER' || role === 'SELLER_STAFF' || tasks.isError) && (
            <IconActionButton
              variant="outline"
              aria-label="Tải lại công việc"
              disabled={tasks.isFetching}
              onClick={async () => {
                const result = await tasks.refetch();
                if (!result.isError) setReload((value) => value + 1);
              }}
              action="reload"
              label="Làm mới"
            />
          )}
          {role === 'SELLER' && (taskSearch || status || page > 1) && (
            <IconActionButton
              action="clear"
              label="Xóa bộ lọc công việc"
              onClick={() => {
                setTaskSearch('');
                setStatus('');
                setPage(1);
              }}
            />
          )}
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
            {isPlatform && tasks.data.items.length > 0 && matchedCount === 0 && (
              <p role="status" className="task-search-empty">
                Không có công việc khớp tìm kiếm trong trang này. Xóa tìm kiếm hoặc chuyển trang để
                xem thêm.
              </p>
            )}
            {tasks.data.items.length === 0 || (role === 'SELLER' && matchedCount === 0) ? (
              <div className="operations-empty">
                <ClipboardList size={36} aria-hidden="true" />
                <h3>
                  {role === 'OPERATIONS_MANAGER' && managerView === 'review'
                    ? 'Chưa có báo cáo chờ duyệt'
                    : role === 'SELLER' && taskSearch
                      ? 'Không có công việc khớp tìm kiếm'
                      : 'Chưa có công việc'}
                </h3>
                {role === 'SELLER_STAFF' && <p>Chưa có công việc trong danh sách này.</p>}
                {isPlatform && (status || page > 1) && (
                  <p className="platform-empty-hint">Thử đổi trạng thái hoặc về trang đầu.</p>
                )}
              </div>
            ) : role === 'ADMIN' || role === 'SELLER' ? (
              <>
                <WorkspaceTable
                  label={role === 'SELLER' ? 'Danh sách công việc' : 'Giám sát công việc'}
                >
                  <table className="admin-monitor-table">
                    <thead>
                      <tr>
                        <th scope="col">Công việc / Kiosk</th>
                        <th scope="col">Người phụ trách</th>
                        <th scope="col">Trạng thái</th>
                        <th scope="col">Báo cáo gần nhất</th>
                        <th scope="col">
                          {role === 'SELLER' ? (
                            <span className="sr-only">Chi tiết</span>
                          ) : (
                            'Chi tiết'
                          )}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {tasks.data.items.filter(matchesSearch).map((task) => (
                        <tr
                          key={task.id}
                          className={role === 'SELLER' ? 'seller-task-row' : undefined}
                          tabIndex={role === 'SELLER' ? 0 : undefined}
                          onClick={
                            role === 'SELLER'
                              ? (event) => {
                                  if (
                                    (event.target as HTMLElement).closest(
                                      'button, a, input, select, textarea',
                                    )
                                  )
                                    return;
                                  setSelectedAdminTask(task.id);
                                }
                              : undefined
                          }
                          onKeyDown={
                            role === 'SELLER'
                              ? (event) => {
                                  if (event.target !== event.currentTarget) return;
                                  if (event.key === 'Enter' || event.key === ' ') {
                                    event.preventDefault();
                                    setSelectedAdminTask(task.id);
                                  }
                                }
                              : undefined
                          }
                        >
                          <td>
                            <strong>
                              {task.workType === 'FLOWER_QUALITY'
                                ? 'Xử lý chất lượng hoa'
                                : task.kind === 'INCIDENT'
                                  ? 'Kiểm tra sự cố'
                                  : task.kind === 'KIOSK_REMOVAL'
                                    ? 'Tháo dỡ kiosk'
                                    : 'Giao hoa'}
                            </strong>
                            <span className="table-secondary">{task.kioskName}</span>
                          </td>
                          <td>{task.assigneeName || '—'}</td>
                          <td>
                            <span className="table-badge" data-state={task.status}>
                              {TASK_STATUS_LABELS[task.status] || task.status}
                            </span>
                          </td>
                          <td>
                            <span className="table-truncate" title={task.report || ''}>
                              {task.report || '—'}
                            </span>
                          </td>
                          <td>
                            <Button
                              type="button"
                              variant="outline"
                              className={role === 'SELLER' ? 'seller-task-open' : undefined}
                              aria-label={`Xem công việc ${task.id}`}
                              onClick={() => setSelectedAdminTask(task.id)}
                            >
                              {role === 'SELLER' ? (
                                <>
                                  <ArrowRight size={18} aria-hidden="true" />
                                  <span className="sr-only">Xem</span>
                                </>
                              ) : (
                                'Xem'
                              )}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </WorkspaceTable>
                {tasks.data.items
                  .filter((task) => task.id === selectedAdminTask)
                  .map((task) => (
                    <Modal
                      key={task.id}
                      open={selectedAdminTask === task.id}
                      onClose={() => setSelectedAdminTask(null)}
                      title={`Công việc: ${task.kioskName}`}
                      size="lg"
                      placement={role === 'SELLER' ? 'right' : 'center'}
                      className={
                        role === 'SELLER' ? 'seller-task-detail-modal' : 'admin-monitor-dialog'
                      }
                    >
                      {selectedAdminTask === task.id && (
                        <TaskItem
                          key={`${task.id}-${task.version}`}
                          task={task}
                          initiallyOpen
                          mode={mode}
                          actorRole={role}
                          actorId={actorId}
                          apiBase={apiBase}
                          sellerId={sellerId}
                          directoryEndpoint={directoryEndpoint}
                          canReassign={canReassign}
                          readOnly={readOnly}
                        />
                      )}
                    </Modal>
                  ))}
              </>
            ) : (
              (mode === 'worker'
                ? [...tasks.data.items].sort((a, b) => {
                    const rank = (state: string) =>
                      state === 'IN_PROGRESS' ? 0 : state === 'ASSIGNED' ? 1 : 2;
                    return rank(a.status) - rank(b.status);
                  })
                : tasks.data.items
              ).map((task) => (
                <TaskItem
                  key={`${task.id}-${role === 'TECHNICIAN' ? task.status : task.version}-${reload}`}
                  hidden={!matchesSearch(task)}
                  task={task}
                  focused={focusedTaskId === task.id}
                  mode={mode}
                  actorRole={role}
                  actorId={actorId}
                  sellerId={sellerId}
                  apiBase={apiBase}
                  directoryEndpoint={directoryEndpoint}
                  canReassign={canReassign}
                  readOnly={readOnly}
                  onOpenChange={handleTaskOpen}
                  onTransition={role === 'OPERATIONS_MANAGER' ? setTransitionResult : undefined}
                />
              ))
            )}
            {(page > 1 ||
              (role === 'SELLER_STAFF' || role === 'SELLER'
                ? tasks.data.hasMore
                : tasks.data.items.length > 0)) && (
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
      </div>
    </section>
  );
}

export const StaffTasks = TaskManagement;
export default TaskManagement;
