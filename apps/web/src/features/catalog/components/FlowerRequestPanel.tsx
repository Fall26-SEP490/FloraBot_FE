import { useEffect, useRef } from 'react';
import { Button, X } from '@florabot/ui';
import type { CatalogItem } from '../catalog.types';
import { canOrderOnWeb } from '../catalog.utils';
import { FlowerRequestForm } from './FlowerRequestForm';

interface FlowerRequestPanelProps {
  selected: CatalogItem | null;
  onClose: () => void;
  onOpenChat: (item: CatalogItem) => void;
  openingChatId: string | null;
}

export function FlowerRequestPanel({
  selected,
  onClose,
  onOpenChat,
  openingChatId,
}: FlowerRequestPanelProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const closeHandler = useRef(onClose);
  useEffect(() => {
    closeHandler.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!selected || !canOrderOnWeb(selected)) return;
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus({ preventScroll: true });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeHandler.current();
      } else if (event.key === 'Tab' && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus({ preventScroll: true });
    };
  }, [selected]);

  if (!selected || !canOrderOnWeb(selected)) return null;

  return (
    <div className="flower-request-backdrop">
      <button
        type="button"
        className="flower-request-scrim"
        tabIndex={-1}
        aria-hidden="true"
        onClick={onClose}
      />
      <section
        ref={dialogRef}
        className="flower-request"
        role="dialog"
        aria-modal="true"
        aria-labelledby="selected-flower"
      >
        <div className="flower-request-heading">
          <div className="flower-request-header-content">
            <h2 id="selected-flower" className="flower-request-title">
              Đặt {selected.name}
            </h2>
            <p className="flower-request-meta">
              {selected.shopName} · {selected.kioskName}
            </p>
          </div>
          <Button
            ref={closeRef}
            variant="outline"
            className="flower-request-close-btn"
            onClick={onClose}
            aria-label="Đóng mẫu đang chọn"
          >
            <X size={18} aria-hidden="true" />
            <span className="sr-only">Đóng mẫu đang chọn</span>
          </Button>
        </div>
        <div className="flower-request-body">
          <FlowerRequestForm
            key={`${selected.productId}-${selected.kioskId}-${selected.slotZone ?? 'template'}`}
            item={selected}
            onOpenChat={() => onOpenChat(selected)}
            openingChat={openingChatId === selected.productId}
          />
        </div>
      </section>
    </div>
  );
}
