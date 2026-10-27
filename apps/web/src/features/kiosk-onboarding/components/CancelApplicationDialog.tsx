import { useEffect, useRef } from 'react';
import { Button, X } from '@florabot/ui';
import type { KioskApplicationResponse } from '../../installations/installations.types';

interface CancelApplicationDialogProps {
  isOpen: boolean;
  status?: KioskApplicationResponse['status'];
  reason: string;
  onReasonChange: (val: string) => void;
  error: string;
  isPending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function CancelApplicationDialog({
  isOpen,
  status,
  reason,
  onReasonChange,
  error,
  isPending,
  onClose,
  onConfirm,
}: CancelApplicationDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;

    previousActiveElementRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab' || !dialogRef.current) return;

      const focusableElements = dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusableElements.length === 0) return;

      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousActiveElementRef.current?.focus();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="kiosk-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cancel-dialog-title"
    >
      <div ref={dialogRef} className="kiosk-modal-card">
        <div className="kiosk-modal-header">
          <h3 id="cancel-dialog-title">Xác nhận hủy hồ sơ thuê kiosk</h3>
          <button
            ref={closeButtonRef}
            type="button"
            className="kiosk-modal-close"
            onClick={onClose}
            aria-label="Đóng"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <p>
          {status === 'PAID_REVIEW'
            ? 'Bạn đã thanh toán phí thuê. Khi xác nhận hủy lúc này, hồ sơ sẽ chuyển sang quy trình hoàn tiền thủ công của Quản trị viên.'
            : 'Bạn có chắc chắn muốn hủy hồ sơ này không? Thao tác này không thể hoàn tác.'}
        </p>
        {error && (
          <p role="alert" className="kiosk-field-error">
            {error}
          </p>
        )}
        <div className="kiosk-form-field">
          <label htmlFor="cancel-reason">Lý do hủy (bắt buộc):</label>
          <textarea
            id="cancel-reason"
            rows={3}
            value={reason}
            onChange={(e) => onReasonChange(e.target.value)}
            placeholder="Ví dụ: Thay đổi kế hoạch kinh doanh hoặc vị trí mặt bằng..."
            required
          />
        </div>
        <div className="kiosk-modal-actions">
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Giữ lại hồ sơ
          </Button>
          <Button onClick={onConfirm} disabled={isPending}>
            {isPending ? 'Đang hủy...' : 'Xác nhận hủy'}
          </Button>
        </div>
      </div>
    </div>
  );
}
