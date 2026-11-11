import { useEffect, useState } from 'react';
import { Button } from '@florabot/ui';
import { ApiError, request } from '@/shared/lib/api';

type LoadingAccess = { id: string; resendAfterSeconds: number; requiresCode: boolean };

export default function PreorderLoadingButton({
  path,
  slotId,
  onAccess,
}: {
  path: string;
  slotId: string;
  onAccess: (id: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    if (wait === 0) return;
    const timer = window.setTimeout(() => setWait((seconds) => seconds - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [wait]);

  async function issue() {
    setBusy(true);
    setError('');
    try {
      const result = await request<LoadingAccess>(path, { slotId });
      onAccess(result.id);
      setWait(result.resendAfterSeconds);
      setNotice(
        result.requiresCode
          ? 'Mã đã gửi qua email. Nhập mã trên màn hình đúng kiosk, nạp hoa rồi xác nhận.'
          : 'Đang có lượt nạp tại ô này. Sau khi đặt hoa vào, bấm xác nhận.',
      );
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 429) setWait(30);
      setError(cause instanceof Error ? cause.message : 'Chưa xác nhận gửi được mã.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        disabled={busy || wait > 0}
        onClick={() => void issue()}
      >
        {busy ? 'Đang gửi mã…' : wait > 0 ? `Gửi lại mã mở ô (${wait}s)` : 'Yêu cầu mở ô'}
      </Button>
      {notice && <p role="status">{notice}</p>}
      {error && <p role="alert">{error}</p>}
    </>
  );
}
