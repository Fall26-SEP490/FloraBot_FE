import { useEffect, useState } from 'react';
import { Button } from '@florabot/ui';
import type { components } from '../../../../../../packages/contracts/src/generated/api';
import { ApiError, request } from '@/shared/lib/api';

type RepairAccess = components['schemas']['MaintenanceAccessIssued'];

export default function TechnicianRepairAccess({
  taskId,
  slotCode,
}: {
  taskId: string;
  slotCode: string | null;
}) {
  const [access, setAccess] = useState<RepairAccess | null>(null);
  const [expired, setExpired] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!access) return;
    const timer = window.setTimeout(
      () => {
        setAccess(null);
        setExpired(true);
      },
      Math.max(0, Date.parse(access.expiresAt) - Date.now()),
    );
    return () => window.clearTimeout(timer);
  }, [access]);

  async function issue() {
    if (busy) return;
    setBusy(true);
    setError('');
    setExpired(false);
    try {
      const issued = await request<RepairAccess>(
        `/staff/tasks/${taskId}/repair-access`,
        undefined,
        false,
        'POST',
      );
      if (!/^\d{6}$/.test(issued.code) || !(Date.parse(issued.expiresAt) > Date.now())) {
        setError('Mã nhận được không còn hiệu lực. Lấy mã mới tại kiosk.');
        return;
      }
      setAccess(issued);
    } catch (cause) {
      setError(
        cause instanceof ApiError && cause.status === 404
          ? 'Chưa cấp được mã. Kiểm tra chủ shop đã duyệt, công việc vẫn được giao cho bạn và tủ đang trực tuyến.'
          : cause instanceof ApiError
            ? cause.message
            : 'Chưa nhận được mã. Kiểm tra kết nối rồi thử lại.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="staff-resolution" aria-label="Mã xác nhận sửa ô tủ">
      <h4>Mã xác nhận sửa ô tủ{slotCode ? ` · ${slotCode}` : ''}</h4>
      <p>Xin chủ shop duyệt ca sửa. Khi đến đúng kiosk, lấy mã rồi nhập trên màn hình kiosk.</p>
      {access ? (
        <p role="status">
          Mã xác nhận <strong>{access.code}</strong> · Hết hạn lúc{' '}
          <time dateTime={access.expiresAt}>
            {new Date(access.expiresAt).toLocaleTimeString('vi-VN')}
          </time>
        </p>
      ) : (
        <Button type="button" variant="outline" disabled={busy} onClick={() => void issue()}>
          {busy ? 'Đang lấy mã…' : expired ? 'Lấy mã mới' : 'Lấy mã sửa ô tủ'}
        </Button>
      )}
      {expired && !access && <p role="status">Mã đã hết hạn.</p>}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
