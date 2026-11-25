import IconActionButton from '@/shared/components/IconActionButton';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Button } from '@florabot/ui';
import { ApiError, queryClient, request } from '@/shared/lib/api';
import type { TaskEvidencePage } from '../task-management/task-management.types';
import type {
  StaffIncidentResolutionAttempt,
  StaffIncidentResolutionProps,
} from './incidents.types';
import { incidentResolutionError, restoreIncidentResolutionAttempt } from './incidents.utils';

export type { StaffIncidentResolutionProps };

export default function StaffIncidentResolution({
  taskId,
  actorId,
  sellerId,
  version,
  active,
  slotRepair = false,
  blockedReason,
  onRefresh,
  apiBase = '/staff/tasks',
}: StaffIncidentResolutionProps) {
  const scopeKey = sellerId ? `seller:${sellerId}` : apiBase;
  const key = `florabot-staff-resolution:${actorId}:${scopeKey}:${taskId}`;
  const [attempt, setAttempt] = useState<StaffIncidentResolutionAttempt | null>(() =>
    restoreIncidentResolutionAttempt(key),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const form = useForm<{ report: string; confirm: boolean }>();
  const evidenceCheck = useQuery({
    queryKey: ['staff-evidence', taskId, actorId, scopeKey, version, 'check'],
    queryFn: () => request<TaskEvidencePage>(`${apiBase}/${taskId}/evidence?page=1`),
    enabled: active,
  });
  const missingEvidence =
    evidenceCheck.isSuccess &&
    Array.isArray(evidenceCheck.data?.items) &&
    evidenceCheck.data.items.length === 0;
  async function send(payload: StaffIncidentResolutionAttempt) {
    if (busy) return;
    setBusy(true);
    setError('');
    let saved = false;
    try {
      sessionStorage.setItem(key, JSON.stringify(payload));
      saved = true;
      setAttempt(payload);
      await request(`${apiBase}/${taskId}/resolve-incident`, payload);
      sessionStorage.removeItem(key);
      setAttempt(null);
      form.reset();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['staff-detail', taskId] }),
        queryClient.invalidateQueries({ queryKey: ['repair-readiness', actorId, apiBase, taskId] }),
        queryClient.invalidateQueries({ queryKey: ['staff-tasks'] }),
        queryClient.invalidateQueries({ queryKey: ['assignment-incidents'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-incidents'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-incident'] }),
      ]);
    } catch (cause) {
      if (cause instanceof ApiError && [400, 403, 404, 409].includes(cause.status)) {
        sessionStorage.removeItem(key);
        setAttempt(null);
        setError(incidentResolutionError(cause, slotRepair));
        if (cause.status === 409) {
          void queryClient.invalidateQueries({
            queryKey: ['repair-readiness', actorId, apiBase, taskId],
          });
          void queryClient.invalidateQueries({ queryKey: ['staff-detail', taskId] });
        }
      } else
        setError(
          !saved
            ? 'Chưa gửi vì không lưu được mã thao tác. Cho phép lưu trữ phiên rồi thử lại.'
            : 'Chưa xác nhận được kết quả. Kiểm tra lại bằng cùng mã thao tác trước khi xử lý tiếp.',
        );
    } finally {
      setBusy(false);
    }
  }
  if (!active && !attempt) return null;
  if (blockedReason && !attempt)
    return (
      <section className="staff-resolution" aria-label="Điều kiện gửi báo cáo sửa ô">
        <h4>Chưa thể gửi báo cáo sửa ô</h4>
        <p role="status">{blockedReason}</p>
        {onRefresh && (
          <Button type="button" variant="outline" onClick={() => void onRefresh()}>
            Cập nhật trạng thái
          </Button>
        )}
      </section>
    );
  return (
    <details className="staff-resolution">
      <summary>{slotRepair ? 'Báo cáo sửa ô tủ' : 'Báo cáo sửa sự cố'}</summary>
      {attempt ? (
        <>
          <p>
            Có kết quả sửa chữa đang chờ xác nhận. Thử lại sẽ gửi báo cáo bằng cùng mã thao tác
            trước đó, không tạo mã mới.
          </p>
          <Button disabled={busy} onClick={() => void send(attempt)}>
            {busy ? 'Đang gửi lại…' : 'Gửi lại báo cáo cùng mã thao tác'}
          </Button>
        </>
      ) : (
        <form
          noValidate
          onSubmit={form.handleSubmit((values) => {
            if (missingEvidence) return;
            void send({ id: crypto.randomUUID(), version, report: values.report.trim() });
          })}
        >
          <label htmlFor={`resolution-report-${taskId}`}>Kết quả kiểm tra</label>
          <textarea
            id={`resolution-report-${taskId}`}
            rows={4}
            maxLength={2000}
            disabled={busy}
            {...form.register('report', {
              validate: (value) => value.trim().length >= 10 || 'Mô tả ít nhất 10 ký tự.',
            })}
            aria-invalid={!!form.formState.errors.report}
            aria-describedby={
              form.formState.errors.report ? `resolution-report-error-${taskId}` : undefined
            }
          />
          {form.formState.errors.report?.message && (
            <p id={`resolution-report-error-${taskId}`} className="error">
              {form.formState.errors.report.message}
            </p>
          )}
          <label>
            <input
              type="checkbox"
              disabled={busy}
              {...form.register('confirm', { required: 'Xác nhận đã kiểm tra thực tế tại tủ.' })}
              aria-invalid={!!form.formState.errors.confirm}
              aria-describedby={
                form.formState.errors.confirm ? `resolution-confirm-error-${taskId}` : undefined
              }
            />{' '}
            Đã kiểm tra tại tủ và xác nhận đã sửa.
          </label>
          {form.formState.errors.confirm?.message && (
            <p id={`resolution-confirm-error-${taskId}`} className="error">
              {form.formState.errors.confirm.message}
            </p>
          )}
          {missingEvidence && (
            <p role="status">
              Cần tải ảnh và bấm <strong>Gắn ảnh vào công việc</strong> ở mục Ảnh minh chứng công
              việc trước khi gửi báo cáo.
            </p>
          )}
          <Button disabled={busy || missingEvidence} type="submit">
            {slotRepair ? 'Gửi báo cáo sửa ô tủ' : 'Ghi nhận và gửi báo cáo'}
          </Button>
        </form>
      )}
      {error && (
        <div>
          <p role="alert">{error}</p>
          {onRefresh && (
            <IconActionButton
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => void onRefresh()}
              action="reload"
              label="Tải lại trạng thái trước khi gửi lại"
            />
          )}
        </div>
      )}
    </details>
  );
}
