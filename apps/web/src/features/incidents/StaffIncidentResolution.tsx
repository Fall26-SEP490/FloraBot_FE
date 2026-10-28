import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@florabot/ui';
import { ApiError, queryClient, request } from '@/shared/lib/api';
import type {
  StaffIncidentResolutionAttempt,
  StaffIncidentResolutionProps,
} from './incidents.types';
import { restoreIncidentResolutionAttempt } from './incidents.utils';

export type { StaffIncidentResolutionProps };

export default function StaffIncidentResolution({
  taskId,
  actorId,
  sellerId,
  version,
  active,
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
      await queryClient.invalidateQueries({ queryKey: ['staff-detail', taskId] });
      await queryClient.invalidateQueries({ queryKey: ['staff-tasks'] });
    } catch (cause) {
      if (cause instanceof ApiError && [400, 403, 404, 409].includes(cause.status)) {
        sessionStorage.removeItem(key);
        setAttempt(null);
        setError(cause.message);
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
  return (
    <details className="staff-resolution">
      <summary>Ghi nhận đã sửa sự cố</summary>
      <p>
        Chỉ xác nhận sau khi kiểm tra tại tủ. Thao tác đóng sự cố, khôi phục trạng thái ô theo dữ
        liệu và gửi báo cáo chờ Quản lý vận hành duyệt.
      </p>
      <p>
        Khoản hoàn tiền đang chờ do quản trị viên xử lý riêng. Thao tác này không mở cửa tủ hay chi
        tiền.
      </p>
      {attempt ? (
        <>
          <p>Có kết quả sửa chữa đang chờ xác nhận.</p>
          <Button disabled={busy} onClick={() => void send(attempt)}>
            {busy ? 'Đang kiểm tra…' : 'Kiểm tra kết quả xử lý'}
          </Button>
        </>
      ) : (
        <form
          noValidate
          onSubmit={form.handleSubmit(
            (values) =>
              void send({ id: crypto.randomUUID(), version, report: values.report.trim() }),
          )}
        >
          <label htmlFor={`resolution-report-${taskId}`}>Kết quả sửa chữa và kiểm tra</label>
          <textarea
            id={`resolution-report-${taskId}`}
            rows={4}
            maxLength={2000}
            disabled={busy}
            {...form.register('report', {
              validate: (value) => value.trim().length >= 10 || 'Mô tả ít nhất 10 ký tự.',
            })}
            aria-invalid={!!form.formState.errors.report}
            aria-describedby={`resolution-report-error-${taskId}`}
          />
          <p id={`resolution-report-error-${taskId}`} className="error">
            {form.formState.errors.report?.message}
          </p>
          <label>
            <input
              type="checkbox"
              disabled={busy}
              {...form.register('confirm', { required: 'Xác nhận đã kiểm tra thực tế tại tủ.' })}
              aria-invalid={!!form.formState.errors.confirm}
              aria-describedby={`resolution-confirm-error-${taskId}`}
            />{' '}
            Tôi đã kiểm tra thực tế và xác nhận sự cố đã được sửa.
          </label>
          <p id={`resolution-confirm-error-${taskId}`} className="error">
            {form.formState.errors.confirm?.message}
          </p>
          <Button disabled={busy} type="submit">
            Đóng sự cố và gửi báo cáo
          </Button>
        </form>
      )}
      {error && <p role="alert">{error}</p>}
    </details>
  );
}
