import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@florabot/ui';
import { ApiError, queryClient, request } from '../../../api';
import StaffIncidentResolution from '../../incidents/StaffIncidentResolution';
import StaffStock from '../../inventory/StaffStock';
import { TASK_STATUS_LABELS } from '../task-management.constants';
import type { ActiveTaskRole, Task } from '../task-management.types';
import StaffEvidence from './StaffEvidence';
import StaffReassignment from './StaffReassignment';
import StaffTaskDetails from './StaffTaskDetails';

export function TaskItem({
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
        <span className="staff-task-label">{TASK_STATUS_LABELS[task.status] || task.status}</span>
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
                {choice === 'IN_PROGRESS' && isManager
                  ? 'Yêu cầu kiểm tra lại'
                  : TASK_STATUS_LABELS[choice]}
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
