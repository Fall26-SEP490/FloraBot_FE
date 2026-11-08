'use client';

import { createPortal } from 'react-dom';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@florabot/ui';
import { Modal } from './Modal';
import { validatePayosCheckoutUrl } from '@/shared/lib/payos-checkout';
import './payos-checkout.css';

export interface PayosCheckoutProps {
  checkoutUrl: string;
  qrCode?: string | null;
  amount?: number | string | null;
  orderCode?: number | string | null;
  recipientName?: string | null;
  recipientAccountMasked?: string | null;
  title: string;
  description: string;
  onClose: (result: 'success' | 'cancel' | 'close') => void;
  onRefresh: () => void;
}

export default function PayosCheckout({
  checkoutUrl,
  qrCode,
  amount,
  orderCode,
  recipientName,
  recipientAccountMasked,
  title,
  description,
  onClose,
  onRefresh,
}: PayosCheckoutProps) {
  const validation = validatePayosCheckoutUrl(checkoutUrl);
  const qrValue = qrCode?.trim() || validation.url || checkoutUrl;
  const hasBankQr = Boolean(qrCode?.trim()?.startsWith('000201'));

  return createPortal(
    <Modal
      open
      title={title}
      description={description}
      onClose={() => onClose('close')}
      size="md"
      className="payos-checkout-modal"
    >
      <div className="payos-native-checkout">
        <div className="payos-qr-section">
          <div className="payos-qr-box">
            {validation.valid && qrValue ? (
              <QRCodeSVG
                value={qrValue}
                size={230}
                marginSize={3}
                title="Mã QR thanh toán PayOS"
                className="payos-qr-svg"
              />
            ) : (
              <p className="payos-qr-error" role="alert">
                {validation.error || 'Địa chỉ thanh toán không hợp lệ.'}
              </p>
            )}
          </div>
          <p className="payos-qr-instruction">
            {hasBankQr
              ? 'Mở ứng dụng ngân hàng quét mã VietQR để thanh toán'
              : 'Quét mã bằng camera hoặc ứng dụng ngân hàng để thanh toán'}
          </p>
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
          {orderCode != null && (
            <div className="payos-detail-row">
              <span className="payos-detail-label">Mã giao dịch / Nội dung</span>
              <span className="payos-detail-value payos-code">FloraBot {orderCode}</span>
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

        <div className="payos-direct-tab-wrap">
          {validation.valid && validation.url && (
            <a
              href={validation.url}
              target="_blank"
              rel="noopener noreferrer"
              className="button button-outline payos-direct-tab-link"
            >
              Mở trang thanh toán PayOS (Mở tab mới) ↗
            </a>
          )}
        </div>

        <div className="payos-checkout-footer">
          <p>Sau khi hoàn tất chuyển khoản, bấm Kiểm tra thanh toán để xác nhận.</p>
          <div className="payos-checkout-footer-buttons">
            <Button variant="default" onClick={onRefresh}>
              Kiểm tra thanh toán
            </Button>
            <Button variant="outline" onClick={() => onClose('close')}>
              Đóng
            </Button>
          </div>
        </div>
      </div>
    </Modal>,
    document.body,
  );
}
