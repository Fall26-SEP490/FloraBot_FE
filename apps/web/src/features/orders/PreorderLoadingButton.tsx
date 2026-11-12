import { useEffect, useRef, useState } from 'react';
import { Button } from '@florabot/ui';
import { ApiError, request } from '@/shared/lib/api';
import type { components } from '../../../../../packages/contracts/src/generated/api';

type LoadingAccess = components['schemas']['PreorderLoadingAccessSent'];

export default function PreorderLoadingButton({
  path,
  slotId,
  onAccess,
  expired,
  disabled,
}: {
  path: string;
  slotId: string;
  onAccess: (access: Pick<LoadingAccess, 'id' | 'expiresAt'>) => void;
  expired: boolean;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const lifecycle = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    lifecycle.current = controller;
    return () => controller.abort();
  }, [path, slotId]);
  useEffect(() => {
    if (wait === 0) return;
    const timer = window.setTimeout(() => setWait((seconds) => seconds - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [wait]);

  async function issue() {
    const signal = lifecycle.current?.signal;
    setBusy(true);
    setError('');
    try {
      const result = await request<LoadingAccess>(path, { slotId });
      if (signal?.aborted) return;
      if (!result.id || !Number.isFinite(Date.parse(result.expiresAt))) {
        throw new Error('Chưa nhận được thời hạn của lượt nạp. Hãy yêu cầu lại.');
      }
      onAccess({ id: result.id, expiresAt: result.expiresAt });
      const cooldown = Number(result.resendAfterSeconds);
      setWait(Number.isFinite(cooldown) ? Math.max(0, Math.ceil(cooldown)) : 0);
      setNotice(
        result.requiresCode
          ? 'Mã đã gửi qua email. Nhập mã trên màn hình đúng kiosk, nạp hoa rồi xác nhận.'
          : 'Đang có lượt nạp tại ô này. Sau khi đặt hoa vào, bấm xác nhận.',
      );
    } catch (cause) {
      if (signal?.aborted) return;
      if (cause instanceof ApiError && cause.status === 429) setWait(30);
      setError(cause instanceof Error ? cause.message : 'Chưa xác nhận gửi được mã.');
    } finally {
      if (!signal?.aborted) setBusy(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        disabled={disabled || busy || wait > 0}
        onClick={() => void issue()}
      >
        {busy
          ? 'Đang gửi mã…'
          : wait > 0
            ? `Gửi lại mã mở ô (${wait}s)`
            : expired
              ? 'Yêu cầu mở ô lại'
              : 'Yêu cầu mở ô'}
      </Button>
      {expired ? (
        <p role="status">
          Đã hết thời hạn xác nhận. Yêu cầu mở ô lại để kiểm tra lượt nạp hoặc nhận mã mới.
        </p>
      ) : (
        notice && <p role="status">{notice}</p>
      )}
      {error && <p role="alert">{error}</p>}
    </>
  );
}
