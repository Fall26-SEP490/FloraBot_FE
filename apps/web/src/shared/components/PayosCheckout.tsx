'use client';

import { createPortal } from 'react-dom';
import { useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Button, RefreshCw } from '@florabot/ui';
import { Modal } from './Modal';
import { validatePayosCheckoutUrl } from '@/shared/lib/payos-checkout';
import './payos-checkout.css';

export interface PayosCheckoutProps {
  checkoutUrl?: string | null;
  qrCode?: string | null;
  amount?: number | string | null;
  recipientName?: string | null;
  recipientAccountMasked?: string | null;
  title: string;
  description: string;
  onClose: () => void;
  onRefresh: () => Promise<boolean>;
  onRetryQr: () => void;
  isLoadingQr?: boolean;
  qrError?: string;
  expired?: boolean;
  retryDisabled?: boolean;
  allowStatusCheck?: boolean;
}

export default function PayosCheckout({
  checkoutUrl,
  qrCode,
  amount,
  recipientName,
  recipientAccountMasked,
  title,
  description,
  onClose,
  onRefresh,
  onRetryQr,
  isLoadingQr = false,
  qrError,
  expired = false,
  retryDisabled = false,
  allowStatusCheck = false,
}: PayosCheckoutProps) {
  const validation = validatePayosCheckoutUrl(qrError ? '' : (checkoutUrl ?? ''));
  const qrValue = qrCode?.trim();
  const hasBankQr = Boolean(validation.valid && qrValue?.startsWith('000201'));
  const canCheckStatus = validation.valid || allowStatusCheck || expired;
  const [verification, setVerification] = useState<'idle' | 'checking' | 'waiting' | 'error'>(
    'idle',
  );
  const checking = useRef(false);
  const [checkedAt, setCheckedAt] = useState('');
  async function verify() {
    if (checking.current || isLoadingQr || !canCheckStatus) return;
    checking.current = true;
    setVerification('checking');
    try {
      const resolved = await onRefresh();
      setCheckedAt(new Date().toLocaleTimeString('vi-VN', { hour12: false }));
      setVerification(resolved ? 'idle' : 'waiting');
    } catch {
      setVerification('error');
    } finally {
      checking.current = false;
    }
  }

  const waitingMessage = expired
    ? verification === 'waiting'
      ? `Đã kiểm tra lúc ${checkedAt}. Hệ thống chưa ghi nhận thanh toán cho đơn hết hạn này. Nếu đã chuyển khoản, đừng thanh toán lại.`
      : 'Mã QR đã hết hạn. Nếu bạn đã chuyển khoản, hãy kiểm tra giao dịch trước khi thực hiện thao tác khác.'
    : 'Hệ thống chưa xác nhận thanh toán. Nếu bạn đã chuyển khoản, đừng thanh toán lại.';
  return createPortal(
    <Modal
      open
      title={title}
      description={description}
      onClose={onClose}
      size="md"
      className="payos-checkout-modal"
    >
      <div className="payos-native-checkout">
        <div className="payos-checkout-content">
          <div className="payos-qr-section" aria-busy={isLoadingQr}>
            <div className="payos-qr-box">
              {expired ? (
                <p className="payos-qr-error" role="status">
                  Mã QR đã hết hạn
                </p>
              ) : isLoadingQr ? (
                <p className="payos-qr-loading" role="status">
                  <RefreshCw size={18} className="payos-loading-icon" aria-hidden="true" />
                  Đang tạo mã QR…
                </p>
              ) : hasBankQr && qrValue ? (
                <QRCodeSVG
                  value={qrValue}
                  size={230}
                  marginSize={3}
                  title="Mã QR thanh toán PayOS"
                  role="img"
                  aria-label="Mã QR thanh toán PayOS"
                  className="payos-qr-svg"
                />
              ) : (
                <p className="payos-qr-error" role="alert">
                  {qrError ||
                    'Chưa có mã VietQR ngân hàng hợp lệ. Vui lòng tải lại mã để thanh toán.'}
                </p>
              )}
            </div>
            {hasBankQr && !expired && !isLoadingQr && (
              <p className="payos-qr-instruction">
                Mở ứng dụng ngân hàng quét mã VietQR để thanh toán
              </p>
            )}
            {!expired && !isLoadingQr && !hasBankQr && (
              <Button
                variant="outline"
                onClick={onRetryQr}
                disabled={retryDisabled || verification === 'checking'}
              >
                Tải lại mã QR
              </Button>
            )}
            {!expired && !isLoadingQr && validation.valid && validation.url && (
              <a className="payos-mobile-link" href={validation.url} rel="noreferrer">
                Thanh toán trên thiết bị này qua PayOS
              </a>
            )}
          </div>

          <div className="payos-payment-details">
            {amount != null && (
              <div className="payos-detail-row">
                <span className="payos-detail-label">Số tiền cần thanh toán</span>
                <span className="payos-detail-value payos-amount">
                  {Number(amount).toLocaleString('vi-VN')} đ
                </span>
              </div>
            )}
            {(recipientName || recipientAccountMasked) && (
              <div className="payos-detail-row">
                <span className="payos-detail-label">Tài khoản nhận</span>
                <span className="payos-detail-value">
                  {[recipientName, recipientAccountMasked].filter(Boolean).join(' · ')}
                </span>
              </div>
            )}
          </div>
        </div>
        <div className="payos-checkout-footer">
          {verification === 'error' ? (
            <p className="payos-feedback" role="alert">
              Chưa kiểm tra được giao dịch. Hãy thử kiểm tra lại. Nếu đã chuyển khoản, đừng thanh
              toán lại.
            </p>
          ) : (
            <p className="payos-feedback" role="status">
              {verification === 'checking' ? (
                <span className="payos-verifying">
                  <RefreshCw size={16} className="payos-loading-icon" aria-hidden="true" />
                  Đang kiểm tra giao dịch…
                </span>
              ) : retryDisabled && !expired ? (
                'Chọn “Kiểm tra trạng thái” trước khi tải lại mã QR để tránh tạo giao dịch trùng.'
              ) : expired || verification === 'waiting' ? (
                waitingMessage
              ) : isLoadingQr || !canCheckStatus ? (
                ''
              ) : (
                'Đã chuyển khoản? Kiểm tra trạng thái của giao dịch.'
              )}
            </p>
          )}
          <div className="payos-checkout-footer-buttons">
            {canCheckStatus && (
              <Button
                variant="default"
                onClick={() => void verify()}
                disabled={isLoadingQr || verification === 'checking'}
                aria-busy={verification === 'checking'}
              >
                {verification === 'checking'
                  ? 'Đang kiểm tra…'
                  : verification === 'error'
                    ? 'Kiểm tra lại'
                    : 'Kiểm tra trạng thái'}
              </Button>
            )}
            <Button variant="outline" onClick={onClose}>
              Đóng
            </Button>
          </div>
        </div>
      </div>
    </Modal>,
    document.body,
  );
}
