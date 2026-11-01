import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, X } from '@florabot/ui';
import { useQuery } from '@tanstack/react-query';
import { sessionQuery } from '@/shared/lib/api';
import type { CatalogItem } from '../catalog.types';
import { canOrderOnWeb } from '../catalog.utils';
import { FlowerRequestForm } from './FlowerRequestForm';

interface FlowerRequestPanelProps {
  selected: CatalogItem | null;
  onClose: () => void;
  onOpenChat: (item: CatalogItem) => void;
  openingChatId: string | null;
}

export function FlowerRequestPanel(props: FlowerRequestPanelProps) {
  const session = useQuery(sessionQuery);
  if (!props.selected || !canOrderOnWeb(props.selected)) return null;
  return (
    <SelectedFlowerRequestPanel
      {...props}
      selected={props.selected}
      key={`${session.data?.id ?? 'guest'}-${props.selected.productId}-${props.selected.kioskId}-${props.selected.zone ?? 'template'}`}
    />
  );
}

function SelectedFlowerRequestPanel({
  selected,
  onClose,
  onOpenChat,
  openingChatId,
}: Omit<FlowerRequestPanelProps, 'selected'> & { selected: CatalogItem }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const keepEditingRef = useRef<HTMLButtonElement>(null);
  const previousDraftFocus = useRef<HTMLElement | null>(null);
  const requestClose = useCallback(() => {
    if (busy) return;
    if (dirty || uncertain) {
      previousDraftFocus.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setConfirmClose(true);
    } else onClose();
  }, [busy, dirty, uncertain, onClose]);
  const cancelClose = useCallback(() => {
    setConfirmClose(false);
    const target = previousDraftFocus.current;
    requestAnimationFrame(() => {
      if (target?.isConnected) target.focus({ preventScroll: true });
    });
  }, []);
  const escapeHandler = useRef(requestClose);
  useEffect(() => {
    escapeHandler.current = confirmClose ? cancelClose : requestClose;
  }, [requestClose, cancelClose, confirmClose]);
  useEffect(() => {
    if (confirmClose) keepEditingRef.current?.focus();
  }, [confirmClose]);

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
        escapeHandler.current();
      } else if (event.key === 'Tab' && dialogRef.current) {
        const focusable = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
          ),
        ).filter((element) => element.getClientRects().length > 0);
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
        onClick={requestClose}
      />
      <section
        ref={dialogRef}
        className="flower-request"
        role="dialog"
        aria-modal="true"
        aria-labelledby={confirmClose ? 'discard-request-title' : 'selected-flower'}
        aria-describedby={confirmClose ? 'discard-request-description' : undefined}
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
            onClick={requestClose}
            disabled={busy}
            aria-label="Đóng mẫu đang chọn"
          >
            <X size={18} aria-hidden="true" />
            <span className="sr-only">Đóng mẫu đang chọn</span>
          </Button>
        </div>
        <div className="flower-request-body">
          {confirmClose && (
            <div className="flower-request-discard" aria-labelledby="discard-request-title">
              <h3 id="discard-request-title">Bạn muốn bỏ nội dung đang nhập?</h3>
              <p id="discard-request-description">
                {uncertain
                  ? 'Kết quả gửi chưa được xác nhận. Hãy kiểm tra đơn đặt trước trước khi tạo yêu cầu mới.'
                  : 'Ngày nhận và lời nhắn chưa gửi sẽ mất khi đóng cửa sổ.'}
              </p>
              <div className="flower-request-discard-actions">
                <Button ref={keepEditingRef} onClick={cancelClose}>
                  Tiếp tục nhập
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setConfirmClose(false);
                    setDirty(false);
                    onClose();
                  }}
                >
                  Bỏ nội dung và đóng
                </Button>
              </div>
            </div>
          )}
          <div
            className="flower-request-form-container"
            hidden={confirmClose}
            style={confirmClose ? { display: 'none' } : undefined}
          >
            <FlowerRequestForm
              key={`${selected.productId}-${selected.kioskId}-${selected.zone ?? 'template'}`}
              item={selected}
              onOpenChat={() => onOpenChat(selected)}
              openingChat={openingChatId === selected.productId}
              onDirtyChange={setDirty}
              onBusyChange={setBusy}
              onUncertainChange={setUncertain}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
