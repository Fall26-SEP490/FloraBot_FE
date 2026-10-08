import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Button } from '@florabot/ui';
import { ApiError, queryClient, request } from './api';

type Fields = { assigneeId: string; reason: string; confirm: boolean };
export default function StaffReassignment({
  taskId,
  version,
  assigneeId,
  assigneeName,
}: {
  taskId: string;
  version: number;
  assigneeId: string;
  assigneeName: string;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState('');
  const form = useForm<Fields>();
  const staff = useQuery({
    queryKey: ['staff-directory'],
    queryFn: () => request<{ id: string; name: string }[]>('/admin/staff'),
    enabled: open,
  });
  const available = staff.data?.filter((person) => person.id !== assigneeId) || [];
  async function submit(values: Fields) {
    if (busy || uncertain) return;
    setBusy(true);
    setError('');
    try {
      await request(`/admin/staff-tasks/${taskId}/reassign`, {
        version,
        assigneeId: values.assigneeId,
        reason: values.reason.trim(),
      });
      await queryClient.invalidateQueries({ queryKey: ['staff-tasks'] });
      await queryClient.invalidateQueries({ queryKey: ['staff-detail', taskId] });
    } catch (cause) {
      const ambiguous = !(cause instanceof ApiError) || cause.status >= 500 || cause.status === 409;
      setUncertain(ambiguous);
      setError(
        ambiguous
          ? 'Chưa xác nhận được người phụ trách mới. Chọn Tải lại công việc để kiểm tra trước khi bàn giao tiếp.'
          : cause.message,
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="staff-reassignment" onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>Đổi người phụ trách</summary>
      <p>
        Hiện phụ trách: {assigneeName}. Sau bàn giao, người cũ mất quyền thao tác và người mới cần
        bắt đầu công việc. Các lần nạp hoa trước đó vẫn được giữ.
      </p>
      {staff.isPending ? (
        <p role="status">Đang tải nhân viên…</p>
      ) : staff.isError ? (
        <>
          <p role="alert">Chưa tải được nhân viên đang hoạt động.</p>
          <Button onClick={() => void staff.refetch()}>Tải lại nhân viên</Button>
        </>
      ) : available.length === 0 ? (
        <p>Chưa có nhân viên khác đang hoạt động để nhận bàn giao.</p>
      ) : (
        <form noValidate onSubmit={form.handleSubmit(submit)}>
          <label htmlFor={`reassign-staff-${taskId}`}>Người nhận bàn giao</label>
          <select
            id={`reassign-staff-${taskId}`}
            disabled={busy || uncertain}
            {...form.register('assigneeId', { required: 'Chọn người nhận bàn giao.' })}
            aria-invalid={!!form.formState.errors.assigneeId}
            aria-describedby={`reassign-staff-error-${taskId}`}
          >
            <option value="">Chọn nhân viên</option>
            {available.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
          <p className="error" id={`reassign-staff-error-${taskId}`}>
            {form.formState.errors.assigneeId?.message}
          </p>
          <label htmlFor={`reassign-reason-${taskId}`}>Lý do và thông tin bàn giao</label>
          <textarea
            id={`reassign-reason-${taskId}`}
            maxLength={2000}
            disabled={busy || uncertain}
            {...form.register('reason', {
              validate: (value) => value.trim().length >= 10 || 'Mô tả ít nhất 10 ký tự.',
            })}
            aria-invalid={!!form.formState.errors.reason}
            aria-describedby={`reassign-reason-error-${taskId}`}
          />
          <p className="error" id={`reassign-reason-error-${taskId}`}>
            {form.formState.errors.reason?.message}
          </p>
          <label className="payout-checkbox">
            <input
              type="checkbox"
              disabled={busy || uncertain}
              {...form.register('confirm', { required: 'Xác nhận thay đổi người phụ trách.' })}
              aria-describedby={`reassign-confirm-error-${taskId}`}
            />{' '}
            Tôi xác nhận thay đổi người phụ trách công việc này.
          </label>
          <p className="error" id={`reassign-confirm-error-${taskId}`}>
            {form.formState.errors.confirm?.message}
          </p>
          <Button type="submit" disabled={busy || uncertain}>
            {busy ? 'Đang bàn giao…' : 'Xác nhận bàn giao'}
          </Button>
        </form>
      )}
      {error && <p role="alert">{error}</p>}
    </details>
  );
}
