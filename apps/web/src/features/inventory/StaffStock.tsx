import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Button } from '@florabot/ui';
import { ApiError, queryClient, request } from '../../api';

import type { ActiveTaskRole } from '../task-management/task-management.types';

type Payload = { id: string; productId: string; slotId: string; qrCode: string };
type Options = {
  products: { id: string; name: string }[];
  slots: { id: string; code: string }[];
  actions: { id: string; qrCode: string; createdAt: string }[];
};
type Fields = Omit<Payload, 'id'> & { confirm: boolean };
function restore(key: string): Payload | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(key) || 'null') as Payload | null;
    return value &&
      ['id', 'productId', 'slotId', 'qrCode'].every(
        (field) => typeof value[field as keyof Payload] === 'string',
      )
      ? value
      : null;
  } catch {
    return null;
  }
}
export type StaffStockProps = {
  taskId: string;
  actorId: string;
  sellerId?: string | null;
  role?: ActiveTaskRole;
  active: boolean;
  apiBase?: string;
};

export default function StaffStock({
  taskId,
  actorId,
  sellerId,
  active,
  apiBase = '/staff/tasks',
}: StaffStockProps) {
  const scopeKey = sellerId ? `seller:${sellerId}` : apiBase;
  const key = `florabot-staff-stock:${actorId}:${scopeKey}:${taskId}`;
  const [attempt, setAttempt] = useState<Payload | null>(() => restore(key));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [open, setOpen] = useState(false);
  const form = useForm<Fields>();
  const path = `${apiBase}/${taskId}/stock`;
  const options = useQuery({
    queryKey: ['staff-stock', taskId, actorId, scopeKey],
    queryFn: () => request<Options>(path),
    enabled: open,
  });
  async function send(payload: Payload) {
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    let saved = false;
    try {
      sessionStorage.setItem(key, JSON.stringify(payload));
      saved = true;
      setAttempt(payload);
      await request(path, payload);
      sessionStorage.removeItem(key);
      setAttempt(null);
      form.reset();
      setNotice('Đã ghi nhận bó hoa vào ô tủ.');
      await queryClient.invalidateQueries({ queryKey: ['staff-stock', taskId] });
      await queryClient.invalidateQueries({ queryKey: ['staff-detail', taskId] });
    } catch (cause) {
      if (cause instanceof ApiError && [400, 403, 404, 409].includes(cause.status)) {
        sessionStorage.removeItem(key);
        setAttempt(null);
        void options.refetch();
      }
      setError(
        !saved
          ? 'Chưa gửi vì không lưu được mã thao tác trên trình duyệt. Cho phép lưu trữ phiên rồi thử lại.'
          : cause instanceof ApiError
            ? cause.message
            : 'Chưa xác nhận được kết quả. Kiểm tra lại bằng cùng mã thao tác trước khi nạp bó khác.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <details onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>Nạp hoa và xem kết quả</summary>
      {attempt ? (
        <>
          <p>Đang chờ xác nhận bó hoa có mã {attempt.qrCode}.</p>
          <Button disabled={busy} onClick={() => void send(attempt)}>
            {busy ? 'Đang kiểm tra…' : 'Kiểm tra kết quả nạp'}
          </Button>
        </>
      ) : options.isPending ? (
        <p role="status">Đang tải ô tủ và sản phẩm được phép…</p>
      ) : options.isError ? (
        <>
          <p role="alert">Chưa tải được thông tin nạp hoa.</p>
          <Button onClick={() => void options.refetch()}>Tải lại thông tin nạp hoa</Button>
        </>
      ) : active && options.data.products.length > 0 && options.data.slots.length > 0 ? (
        <form
          noValidate
          onSubmit={form.handleSubmit((values) =>
            send({
              id: crypto.randomUUID(),
              productId: values.productId,
              slotId: values.slotId,
              qrCode: values.qrCode.trim(),
            }),
          )}
        >
          <p>Ghi nhận sau khi đã đặt bó hoa đúng ô. Thao tác này không gửi lệnh mở cửa.</p>
          <label htmlFor={`stock-product-${taskId}`}>Mẫu hoa cần nạp</label>
          <select
            id={`stock-product-${taskId}`}
            {...form.register('productId', { required: 'Chọn mẫu hoa.' })}
            aria-invalid={!!form.formState.errors.productId}
            aria-describedby={`stock-product-error-${taskId}`}
          >
            <option value="">Chọn mẫu hoa</option>
            {options.data.products.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <p id={`stock-product-error-${taskId}`} className="error">
            {form.formState.errors.productId?.message}
          </p>
          <label htmlFor={`stock-slot-${taskId}`}>Ô tủ trống</label>
          <select
            id={`stock-slot-${taskId}`}
            {...form.register('slotId', { required: 'Chọn ô tủ.' })}
            aria-invalid={!!form.formState.errors.slotId}
            aria-describedby={`stock-slot-error-${taskId}`}
          >
            <option value="">Chọn ô tủ</option>
            {options.data.slots.map((item) => (
              <option key={item.id} value={item.id}>
                {item.code}
              </option>
            ))}
          </select>
          <p id={`stock-slot-error-${taskId}`} className="error">
            {form.formState.errors.slotId?.message}
          </p>
          <label htmlFor={`stock-qr-${taskId}`}>Mã QR trên bó hoa</label>
          <input
            id={`stock-qr-${taskId}`}
            maxLength={120}
            autoComplete="off"
            {...form.register('qrCode', {
              validate: (value) => !!value.trim() || 'Nhập hoặc quét mã bó hoa.',
            })}
            aria-invalid={!!form.formState.errors.qrCode}
            aria-describedby={`stock-qr-error-${taskId}`}
          />
          <p id={`stock-qr-error-${taskId}`} className="error">
            {form.formState.errors.qrCode?.message}
          </p>
          <label className="payout-checkbox">
            <input
              type="checkbox"
              {...form.register('confirm', { required: 'Xác nhận đã đặt hoa đúng ô.' })}
              aria-describedby={`stock-confirm-error-${taskId}`}
            />{' '}
            Tôi đã đặt đúng bó hoa vào ô đã chọn.
          </label>
          <p id={`stock-confirm-error-${taskId}`} className="error">
            {form.formState.errors.confirm?.message}
          </p>
          <Button type="submit" disabled={busy}>
            Ghi nhận đã nạp hoa
          </Button>
        </form>
      ) : (
        <p>
          {active
            ? 'Không còn ô trống hoặc sản phẩm hợp lệ. Kiểm tra với chủ shop trước khi nạp.'
            : 'Chỉ có thể nạp hoa khi công việc đang thực hiện. Bạn vẫn có thể xem các bó đã ghi nhận bên dưới.'}
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {options.data && (
        <>
          <h4>Các bó đã ghi nhận trong công việc</h4>
          {options.data.actions.length === 0 ? (
            <p>Chưa có bó hoa được ghi nhận.</p>
          ) : (
            <ul>
              {options.data.actions.map((item) => (
                <li key={item.id}>
                  {item.qrCode} · {new Date(item.createdAt).toLocaleString('vi-VN')}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </details>
  );
}
