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
        queryClient.invalidateQueries({ queryKey: ['staff-tasks'] }),
        queryClient.invalidateQueries({ queryKey: ['assignment-incidents'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-incidents'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-incident'] }),
      ]);
    } catch (cause) {
      if (cause instanceof ApiError && [400, 403, 404, 409].includes(cause.status)) {
        sessionStorage.removeItem(key);
        setAttempt(null);
        setError(
          cause.status === 409 && slotRepair
            ? 'Hệ thống chưa chấp nhận báo cáo sửa ô. Cần kiểm tra trạng thái công việc, quyền sửa, chu kỳ cửa và cảm biến trước khi gửi lại.'
            : cause.message,
        );
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
        <h4>Cần kiểm tra trạng thái ô trước khi hoàn tất</h4>
        <p role="status">{blockedReason}</p>
        <p>
          Bạn vẫn có thể bổ sung ảnh minh chứng cho công việc. Ghi nhận đã đến tủ hoặc tải ảnh chưa
          xác nhận ô đã được sửa.
        </p>
        {onRefresh && (
          <Button type="button" variant="outline" onClick={() => void onRefresh()}>
            Cập nhật trạng thái công việc
          </Button>
        )}
      </section>
    );
  return (
    <details className="staff-resolution">
      <summary>{slotRepair ? 'Báo cáo kết quả sửa ô tủ' : 'Ghi nhận đã sửa sự cố'}</summary>
      <p>
        {slotRepair
          ? 'Sau khi xác nhận mã tại kiosk, kiểm tra ô rồi đóng cửa. Gửi báo cáo khi tủ đã ghi nhận cửa đóng và tình trạng hoa. Quản lý vận hành sẽ duyệt và đóng sự cố.'
          : 'Chỉ xác nhận sau khi kiểm tra tại tủ. Gửi kết quả để ghi nhận sự cố đã được xử lý và chuyển báo cáo cho Quản lý vận hành nghiệm thu công việc.'}
      </p>
      <p>
        Nếu có khoản hoàn tiền, shop thực hiện và quản trị viên đối chiếu theo luồng hoàn tiền
        riêng. Thao tác này không mở cửa tủ hay chi tiền.
      </p>
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
            Tôi đã kiểm tra thực tế và xác nhận sự cố đã được sửa.
          </label>
          {form.formState.errors.confirm?.message && (
            <p id={`resolution-confirm-error-${taskId}`} className="error">
              {form.formState.errors.confirm.message}
            </p>
          )}
          <Button disabled={busy} type="submit">
            {slotRepair ? 'Gửi báo cáo sửa ô tủ' : 'Ghi nhận và gửi báo cáo'}
          </Button>
        </form>
      )}
      {error && (
        <div>
          <p role="alert">{error}</p>
          {onRefresh && (
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => void onRefresh()}
            >
              Tải lại trạng thái trước khi gửi lại
            </Button>
          )}
        </div>
      )}
    </details>
  );
}
