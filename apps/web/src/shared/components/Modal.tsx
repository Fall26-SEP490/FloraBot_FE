'use client';

import { useEffect, useEffectEvent, useId, useRef, type ReactNode } from 'react';
import { X } from '@florabot/ui';
// Modal foundation styles are provided globally via site.css (@import './modal.css')

const focusableSelector =
  'iframe, button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export type ModalSize = 'sm' | 'md' | 'lg';

export function Modal({
  open,
  title,
  description,
  titleIcon,
  headerActions,
  onClose,
  children,
  closeDisabled = false,
  size = 'md',
  className = '',
}: {
  open: boolean;
  title: string;
  description?: string;
  titleIcon?: ReactNode;
  headerActions?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  closeDisabled?: boolean;
  size?: ModalSize;
  className?: string;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeOnEscape = useEffectEvent(() => onClose());
  const isCloseDisabled = useEffectEvent(() => closeDisabled);

  useEffect(() => {
    if (!open) return;
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const panel = panelRef.current;
    const visibleFields = () =>
      Array.from(panel?.querySelectorAll<HTMLElement>(focusableSelector) ?? []).filter(
        (element) =>
          element.tabIndex >= 0 &&
          element.getClientRects().length > 0 &&
          !element.closest('[aria-hidden="true"]'),
      );
    const first = panel?.querySelector<HTMLElement>('[data-autofocus]') ?? visibleFields()[0];
    first?.focus({ preventScroll: true });

    const onKeyDown = (event: KeyboardEvent) => {
      const panels = document.querySelectorAll('.management-modal');
      if (panels[panels.length - 1] !== panel) return;
      if (event.key === 'Escape' && !isCloseDisabled()) {
        event.preventDefault();
        event.stopPropagation();
        closeOnEscape();
        return;
      }
      if (event.key !== 'Tab' || !panel) return;
      const focusable = visibleFields();
      if (focusable.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const firstElement = focusable[0];
      const lastElement = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    document.body.classList.add('modal-open');
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      const remainingModals = document.querySelectorAll('.management-modal-backdrop').length;
      if (remainingModals <= 1) {
        document.body.classList.remove('modal-open');
      }
      previousFocus?.focus({ preventScroll: true });
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="management-modal-backdrop">
      <button
        type="button"
        className="management-modal-dismiss"
        aria-label="Đóng hộp thoại"
        tabIndex={-1}
        disabled={closeDisabled}
        onClick={onClose}
      />
      <div
        ref={panelRef}
        className={`management-modal management-modal--${size}${className ? ` ${className}` : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
      >
        <header className="management-modal-header" role="presentation">
          <div className="management-modal-heading-text">
            <h2 id={titleId}>
              {titleIcon}
              {title}
            </h2>
            {description && <p id={descriptionId}>{description}</p>}
          </div>
          {headerActions}
          <button
            type="button"
            className="management-modal-close"
            onClick={onClose}
            disabled={closeDisabled}
            aria-label="Đóng hộp thoại"
          >
            <X size={18} aria-hidden="true" />
            <span className="sr-only">Đóng hộp thoại</span>
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  onConfirm,
  onCancel,
  pending = false,
  variant = 'danger',
  size = 'sm',
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  pending?: boolean;
  variant?: 'danger' | 'primary';
  size?: ModalSize;
}) {
  return (
    <Modal
      open={open}
      title={title}
      description={description}
      onClose={onCancel}
      closeDisabled={pending}
      size={size}
    >
      <div className="management-modal-actions" aria-busy={pending}>
        <button
          type="button"
          className="button button-outline"
          data-autofocus
          onClick={onCancel}
          disabled={pending}
        >
          Hủy
        </button>
        <button
          type="button"
          className={`button ${variant === 'danger' ? 'management-danger-button' : 'button-primary'}`}
          onClick={onConfirm}
          disabled={pending}
        >
          {pending ? 'Đang cập nhật…' : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
