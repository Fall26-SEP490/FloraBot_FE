import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@florabot/ui';
import { ApiError, queryClient, request } from '@/shared/lib/api';

type Preorder = {
  requestId: string;
  orderCode: string;
  productName: string;
  pickupAt: string;
};
type Slot = { id: string; slotCode: string; zone: string | null };
type Options = { preorders: Preorder[]; slots: Slot[] };

export default function StaffPreorderFulfillment({
  taskId,
  active,
}: {
  taskId: string;
  active: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [requestId, setRequestId] = useState('');
  const [slotId, setSlotId] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [uncertain, setUncertain] = useState(false);
  const options = useQuery({
    queryKey: ['staff-preorders', taskId],
    queryFn: () => request<Options>(`/staff/tasks/${taskId}/preorders`),
    enabled: open && active,
  });
  const validSlots = options.data?.slots.filter((slot) => slot.zone === 'PREORDER') ?? [];

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || uncertain || !active) return;
    if (
      !options.data?.preorders.some((order) => order.requestId === requestId) ||
      !validSlots.some((slot) => slot.id === slotId) ||
      !qrCode.trim() ||
      qrCode.trim().length > 120
    ) {
      setError('Chọn đơn đã thanh toán, ô PREORDER trống và nhập mã QR hợp lệ.');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await request(`/staff/tasks/${taskId}/preorders/${requestId}/fulfill`, {
        slotId,
        qrCode: qrCode.trim(),
      });
      setRequestId('');
      setSlotId('');
      setQrCode('');
      setNotice('Đã ghi nhận hoa của đơn vào ô PREORDER.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['staff-preorders', taskId] }),
        queryClient.invalidateQueries({ queryKey: ['staff-tasks'] }),
        queryClient.invalidateQueries({ queryKey: ['web-orders'] }),
      ]);
    } catch (cause) {
      const ambiguous = !(cause instanceof ApiError) || cause.status >= 500;
      setUncertain(ambiguous);
      setError(
        ambiguous
          ? 'Chưa xác nhận được kết quả nạp. Tải lại danh sách và kiểm tra đơn/ô trước khi thử lại để tránh nạp trùng.'
          : cause.message,
      );
      if (!ambiguous) void options.refetch();
    } finally {
      setBusy(false);
    }
  }

  return (
    <details onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>Nạp đơn đặt trước đã thanh toán</summary>
      {!active ? (
        <p>Chuyển công việc sang “Đang thực hiện” trước khi nạp đơn đặt trước.</p>
      ) : options.isPending ? (
        <p role="status">Đang tải đơn và ô PREORDER phù hợp…</p>
      ) : options.isError ? (
        <p role="alert">
          Chưa tải được đơn và ô phù hợp.{' '}
          <Button type="button" onClick={() => void options.refetch()}>
            Tải lại
          </Button>
        </p>
      ) : (
        <form onSubmit={(event) => void submit(event)}>
          <p>
            Chỉ các đơn đã thanh toán trong thời gian giao và ô phù hợp tại kiosk này được hiển thị.
          </p>
          <label htmlFor={`preorder-${taskId}`}>Đơn đặt trước</label>
          <select
            id={`preorder-${taskId}`}
            value={requestId}
            onChange={(event) => setRequestId(event.target.value)}
            required
            disabled={busy || uncertain}
          >
            <option value="">Chọn đơn</option>
            {options.data.preorders.map((order) => (
              <option key={order.requestId} value={order.requestId}>
                {order.orderCode} · {order.productName} ·{' '}
                {new Date(order.pickupAt).toLocaleString('vi-VN')}
              </option>
            ))}
          </select>
          <label htmlFor={`preorder-slot-${taskId}`}>Ô PREORDER trống</label>
          <select
            id={`preorder-slot-${taskId}`}
            value={slotId}
            onChange={(event) => setSlotId(event.target.value)}
            required
            disabled={busy || uncertain}
          >
            <option value="">Chọn ô</option>
            {validSlots.map((slot) => (
              <option key={slot.id} value={slot.id}>
                {slot.slotCode}
              </option>
            ))}
          </select>
          <label htmlFor={`preorder-qr-${taskId}`}>Mã QR bó hoa</label>
          <input
            id={`preorder-qr-${taskId}`}
            value={qrCode}
            onChange={(event) => setQrCode(event.target.value)}
            maxLength={120}
            required
            disabled={busy || uncertain}
          />
          {options.data.preorders.length === 0 && (
            <p>Chưa có đơn đã thanh toán trong thời gian giao.</p>
          )}
          {validSlots.length === 0 && <p>Chưa có ô PREORDER trống phù hợp.</p>}
          <Button
            type="submit"
            disabled={
              busy || uncertain || options.data.preorders.length === 0 || validSlots.length === 0
            }
          >
            {busy ? 'Đang ghi nhận…' : 'Xác nhận đã nạp vào ô'}
          </Button>
          {uncertain && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setUncertain(false);
                void options.refetch();
              }}
            >
              Tải lại để kiểm tra
            </Button>
          )}
        </form>
      )}
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
    </details>
  );
}
