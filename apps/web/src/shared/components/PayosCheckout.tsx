'use client';

import { useEffect, useEffectEvent, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@florabot/ui';
import { Modal } from './Modal';
import { loadPayosCheckout, validatePayosCheckoutUrl } from '@/shared/lib/payos-checkout';
import './payos-checkout.css';

export default function PayosCheckout({
  checkoutUrl,
  title,
  description,
  onClose,
  onRefresh,
}: {
  checkoutUrl: string;
  title: string;
  description: string;
  onClose: (result: 'success' | 'cancel' | 'close') => void;
  onRefresh: () => void;
}) {
  const id = `payos-${useId().replace(/:/g, '')}`;
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const finish = useEffectEvent(onClose);
  const validation = validatePayosCheckoutUrl(checkoutUrl);

  useEffect(() => {
    let disposed = false;
    let checkout: { exit: () => void } | undefined;
    let loadTimer: number | undefined;
    const container = document.getElementById(id);
    const validated = validatePayosCheckoutUrl(checkoutUrl);
    if (!validated.valid || !validated.url || !container) return;

    void loadPayosCheckout()
      .then((sdk) => {
        if (disposed) return;
        const controller = sdk.usePayOS({
          RETURN_URL: encodeURIComponent(window.location.href),
          ELEMENT_ID: id,
          CHECKOUT_URL: validated.url!,
          embedded: true,
          onSuccess: () => finish('success'),
          onCancel: () => finish('cancel'),
          onExit: () => finish('close'),
        });
        checkout = controller;
        controller.open();
        const iframe = container.querySelector('iframe');
        if (!iframe) throw new Error('Chưa mở được màn hình thanh toán. Vui lòng thử lại.');
        iframe.title = 'Thanh toán bảo mật qua PayOS';
        iframe.addEventListener(
          'load',
          () => {
            if (disposed) return;
            window.clearTimeout(loadTimer);
            setLoading(false);
          },
          { once: true },
        );
        loadTimer = window.setTimeout(() => {
          if (disposed) return;
          setLoading(false);
          setError('PayOS đang tải chậm. Bạn có thể tải lại hoặc mở trang PayOS để tiếp tục.');
        }, 20_000);
      })
      .catch((cause: unknown) => {
        if (disposed) return;
        setLoading(false);
        setError(cause instanceof Error ? cause.message : 'Chưa mở được PayOS. Vui lòng thử lại.');
      });

    return () => {
      disposed = true;
      window.clearTimeout(loadTimer);
      if (container.querySelector('iframe')) checkout?.exit();
    };
  }, [attempt, checkoutUrl, id]);

  return createPortal(
    <Modal
      open
      title={title}
      description={description}
      onClose={() => onClose('close')}
      size="lg"
      className="payos-checkout-modal"
    >
      <p className="payos-checkout-note">Quét mã QR hoặc chọn cách thanh toán trên PayOS.</p>
      {loading && validation.valid && <p role="status">Đang mở màn hình thanh toán…</p>}
      {(!validation.valid || error) && (
        <div className="payos-checkout-error" role="alert">
          <p>{validation.error || error}</p>
          {validation.valid && (
            <div className="payos-checkout-recovery">
              <Button
                variant="outline"
                onClick={() => {
                  setLoading(true);
                  setError('');
                  setAttempt((value) => value + 1);
                }}
              >
                Tải lại màn hình
              </Button>
              <a className="button button-outline" href={validation.url}>
                Mở trang PayOS
              </a>
            </div>
          )}
        </div>
      )}
      <div id={id} className="payos-checkout-frame" hidden={!validation.valid || Boolean(error)} />
      <div className="payos-checkout-footer">
        <p>Nếu đã chuyển tiền, kiểm tra trạng thái trước khi thanh toán lại.</p>
        <Button variant="outline" onClick={onRefresh}>
          Kiểm tra thanh toán
        </Button>
      </div>
    </Modal>,
    document.body,
  );
}
