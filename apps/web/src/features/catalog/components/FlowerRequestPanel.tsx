import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button, X, useHydrated } from '@florabot/ui';
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
  const hydrated = useHydrated();
  if (!hydrated || !props.selected || !canOrderOnWeb(props.selected)) return null;
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
  const [failedPhoto, setFailedPhoto] = useState<string | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [leaveForChat, setLeaveForChat] = useState(false);
  const keepEditingRef = useRef<HTMLButtonElement>(null);
  const previousDraftFocus = useRef<HTMLElement | null>(null);
  const requestClose = useCallback(() => {
    if (busy) return;
    if (dirty || uncertain) {
      previousDraftFocus.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setLeaveForChat(false);
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
  const confirmLeave = () => {
    setConfirmClose(false);
    if (leaveForChat) onOpenChat(selected);
    else onClose();
  };
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

  return createPortal(
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
        aria-labelledby="selected-flower"
        aria-describedby={confirmClose ? 'discard-request-description' : undefined}
      >
        <div className="flower-request-heading">
          <div className="flower-request-header-content">
            <h2 id="selected-flower" className="flower-request-title">
              {confirmClose
                ? leaveForChat
                  ? 'Chuyển sang tin nhắn?'
                  : 'Đóng yêu cầu đặt trước?'
                : 'Yêu cầu đặt trước'}
            </h2>
          </div>
          <Button
            ref={closeRef}
            variant="outline"
            className="flower-request-close-btn"
            onClick={confirmClose ? (leaveForChat ? cancelClose : confirmLeave) : requestClose}
            disabled={busy}
            aria-label={
              confirmClose
                ? leaveForChat
                  ? 'Quay lại biểu mẫu'
                  : 'Đóng cửa sổ'
                : 'Đóng mẫu đang chọn'
            }
          >
            <X size={18} aria-hidden="true" />
          </Button>
          {!confirmClose && (
            <div className="flower-request-product-row">
              {selected.photo && (
                <img
                  src={
                    failedPhoto === selected.photo
                      ? '/images/floral-white-online.webp'
                      : selected.photo
                  }
                  onError={() => setFailedPhoto(selected.photo!)}
                  alt=""
                  className="flower-request-header-thumb"
                  aria-hidden="true"
                />
              )}
              <div className="flower-request-product-info">
                <span className="flower-request-header-name" title={selected.name}>
                  {selected.name}
                </span>
                <p className="flower-request-meta">{selected.shopName}</p>
              </div>
            </div>
          )}
        </div>
        <div className="flower-request-body">
          {confirmClose && (
            <div className="flower-request-discard">
              <p id="discard-request-description">
                {uncertain
                  ? 'Kết quả gửi chưa được xác nhận. Hãy kiểm tra đơn đặt trước trước khi tạo yêu cầu mới.'
                  : leaveForChat
                    ? 'Thông tin đang nhập sẽ không được lưu khi mở tin nhắn.'
                    : 'Thông tin chưa gửi sẽ không được lưu.'}
              </p>
              <div className="flower-request-discard-actions">
                <Button ref={keepEditingRef} onClick={cancelClose}>
                  Tiếp tục nhập
                </Button>
                <Button variant="outline" onClick={confirmLeave}>
                  {leaveForChat ? 'Mở tin nhắn' : 'Đóng form'}
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
              onOpenChat={() => {
                if (!dirty && !uncertain) return onOpenChat(selected);
                previousDraftFocus.current =
                  document.activeElement instanceof HTMLElement ? document.activeElement : null;
                setLeaveForChat(true);
                setConfirmClose(true);
              }}
              openingChat={openingChatId === selected.productId}
              onDirtyChange={setDirty}
              onBusyChange={setBusy}
              onUncertainChange={setUncertain}
            />
          </div>
        </div>
      </section>
    </div>,
    document.body,
  );
}
