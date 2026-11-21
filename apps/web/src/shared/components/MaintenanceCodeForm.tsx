import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '@florabot/ui';
import { ApiError, request } from '@/shared/lib/api';
import styles from './maintenance-code-form.module.css';
import type { components } from '../../../../../packages/contracts/src/generated/api';

type ConfirmedAccess = components['schemas']['AcceptedMaintenanceAccess'];

export default function MaintenanceCodeForm({
  challenge,
  onConfirmed,
}: {
  challenge: { id: string; expiresAt: string };
  onConfirmed: (result: ConfirmedAccess) => void;
}) {
  const inputId = useId();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [expired, setExpired] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const sending = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    const timer = window.setTimeout(
      () => setExpired(true),
      Math.max(0, Date.parse(challenge.expiresAt) - Date.now()),
    );
    return () => {
      mounted.current = false;
      window.clearTimeout(timer);
    };
  }, [challenge.expiresAt]);

  async function confirm() {
    if (
      sending.current ||
      sent ||
      expired ||
      Date.parse(challenge.expiresAt) <= Date.now() ||
      !/^\d{6}$/.test(code)
    )
      return;
    sending.current = true;
    setBusy(true);
    setError('');
    try {
      const result = await request<ConfirmedAccess>(
        `/me/maintenance-access/${challenge.id}/confirm`,
        { code },
        false,
      );
      if (!mounted.current) return;
      setSent(true);
      setCode('');
      onConfirmed(result);
    } catch (cause) {
      if (!mounted.current) return;
      setError(
        cause instanceof ApiError && cause.status === 404
          ? 'Mã đã hết hạn, đã dùng hoặc không còn hiệu lực. Lấy mã mới để tiếp tục.'
          : cause instanceof ApiError
            ? cause.message
            : 'Chưa xác nhận được lệnh mở ô. Kiểm tra cửa tủ trước khi thử lại.',
      );
    } finally {
      sending.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  return (
    <div className="maintenance-code-form">
      {sent ? (
        <p role="status">Đã gửi lệnh mở ô. Chờ tủ phản hồi.</p>
      ) : (
        <>
          <label htmlFor={inputId}>Mã OTP 6 số</label>
          <div className={styles.fields}>
            <input
              id={inputId}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              disabled={busy || expired}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void confirm();
                }
              }}
            />
            <Button
              type="button"
              disabled={busy || expired || code.length !== 6}
              onClick={() => void confirm()}
            >
              {busy ? 'Đang xác nhận…' : 'Xác nhận mở ô'}
            </Button>
          </div>
          {expired && <p role="status">Mã đã hết hạn. Lấy mã mới để tiếp tục.</p>}
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
