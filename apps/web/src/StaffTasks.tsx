import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Button } from '@florabot/ui';
import { ApiError, queryClient, request } from './api';
import AdminTaskAssignment from './AdminTaskAssignment';
import StaffStock from './StaffStock';
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

function TaskItem({ task, admin, staffId }: { task: Task; admin: boolean; staffId?: string }) {
  const form = useForm<{ report: string; status: string }>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [uncertain, setUncertain] = useState(false);
  const [notice, setNotice] = useState('');
  const prefix = admin ? '/admin/staff-tasks' : '/staff/tasks';
  const choices = admin
    ? task.status === 'SUBMITTED'
      ? ['COMPLETED', 'IN_PROGRESS', 'CANCELLED']
      : ['ASSIGNED', 'IN_PROGRESS'].includes(task.status)
        ? ['CANCELLED']
        : []
    : task.status === 'ASSIGNED'
      ? ['IN_PROGRESS']
      : task.status === 'IN_PROGRESS'
        ? ['SUBMITTED']
        : [];
  async function submit(values: { report: string; status: string }) {
    if (busy || uncertain) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await request(`${prefix}/${task.id}/transition`, { ...values, version: task.version });
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
      <StaffTaskDetails taskId={task.id} version={task.version} admin={admin} />
      <StaffEvidence
        key={`${task.id}:${task.version}:${staffId}`}
        taskId={task.id}
        version={task.version}
        admin={admin}
        actorId={staffId}
        active={task.status === 'IN_PROGRESS'}
      />
      {admin && ['ASSIGNED', 'IN_PROGRESS'].includes(task.status) && (
        <StaffReassignment
          taskId={task.id}
          version={task.version}
          assigneeId={task.assigneeId}
          assigneeName={task.assigneeName}
        />
      )}
      {task.report && (
        <p>
          <strong>Báo cáo gần nhất:</strong> {task.report}
        </p>
      )}
      {!admin && staffId && task.kind === 'DELIVERY' && (
        <StaffStock taskId={task.id} actorId={staffId} active={task.status === 'IN_PROGRESS'} />
      )}
      {!admin && staffId && task.kind === 'INCIDENT' && (
        <StaffIncidentResolution
          taskId={task.id}
          actorId={staffId}
          version={task.version}
          active={task.status === 'IN_PROGRESS'}
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
                {choice === 'IN_PROGRESS' && admin ? 'Yêu cầu kiểm tra lại' : labels[choice]}
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

export default function StaffTasks({
  admin = false,
  adminId,
  staffId,
}: {
  admin?: boolean;
  adminId?: string;
  staffId?: string;
}) {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [reload, setReload] = useState(0);
  const tasks = useQuery({
    queryKey: ['staff-tasks', admin, page, status],
    queryFn: () =>
      request<Page>(
        `${admin ? '/admin/staff-tasks' : '/staff/tasks'}?page=${page}${status ? `&status=${status}` : ''}`,
      ),
  });
  return (
    <section id="staff-tasks" aria-labelledby="staff-tasks-title">
      <h2 id="staff-tasks-title">{admin ? 'Công việc nhân viên' : 'Công việc được giao'}</h2>
      {admin && adminId && <AdminTaskAssignment adminId={adminId} />}
      <p>
        {admin
          ? 'Duyệt báo cáo hoặc yêu cầu kiểm tra lại. Việc đóng sự cố và duyệt tiền được xử lý riêng.'
          : 'Bắt đầu công việc, ghi nhận kết quả và gửi báo cáo để quản trị viên duyệt.'}
      </p>
      <div className="staff-task-toolbar">
        <div>
          <label htmlFor="task-status">Lọc trạng thái</label>
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
            <p>Chưa có công việc trong danh sách này.</p>
          ) : (
            tasks.data.items.map((task) => (
              <TaskItem
                key={`${task.id}-${task.version}-${reload}`}
                task={task}
                admin={admin}
                staffId={staffId}
              />
            ))
          )}
          <nav aria-label="Phân trang công việc">
            <Button
              variant="outline"
              disabled={page === 1 || tasks.isFetching}
              onClick={() => setPage(page - 1)}
            >
              Trang trước
            </Button>
            <span aria-live="polite"> Trang {page} </span>
            <Button
              variant="outline"
              disabled={!tasks.data.hasMore || tasks.isFetching}
              onClick={() => setPage(page + 1)}
            >
              Trang sau
            </Button>
          </nav>
        </>
      )}
    </section>
  );
}
