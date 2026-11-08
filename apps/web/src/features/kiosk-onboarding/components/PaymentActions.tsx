import { Banknote, Button, CircleAlert, RefreshCw } from '@florabot/ui';

interface PaymentActionsProps {
  packageName: string;
  annualFee: number | string;
  checkoutUrl?: string | null;
  paymentLinkError: string;
  isGeneratingLink: boolean;
  isReconciling: boolean;
  onGenerateLink: () => void;
  onReconcile: () => void;
}

export function PaymentActions({
  packageName,
  annualFee,
  checkoutUrl,
  paymentLinkError,
  isGeneratingLink,
  isReconciling,
  onGenerateLink,
  onReconcile,
}: PaymentActionsProps) {
  return (
    <div className="status-action-box" data-action="payment">
      <h3>Thanh toán phí thuê kiosk</h3>
      <p>{packageName}</p>
      <p>
        Số tiền: <strong>{Number(annualFee).toLocaleString('vi-VN')} đ</strong> (cho thời hạn 1 năm,
        tính từ khi bàn giao).
      </p>

      {paymentLinkError && (
        <div role="alert" className="kiosk-field-error-banner">
          <CircleAlert size={18} aria-hidden="true" />
          <span>{paymentLinkError}</span>
        </div>
      )}

      <div className="action-buttons-row">
        <Button onClick={onGenerateLink} disabled={isGeneratingLink}>
          <Banknote size={18} aria-hidden="true" />
          {isGeneratingLink ? 'Đang mở thanh toán…' : 'Thanh toán phí thuê'}
        </Button>
        {checkoutUrl && (
          <a
            href={checkoutUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="button button-outline"
          >
            Mở cổng PayOS (Tab mới) ↗
          </a>
        )}
        <Button variant="outline" onClick={onReconcile} disabled={isReconciling}>
          <RefreshCw className={isReconciling ? 'kiosk-spin' : ''} size={18} aria-hidden="true" />
          Kiểm tra thanh toán
        </Button>
      </div>

      <p className="kiosk-help-text">
        Thanh toán qua PayOS ngay trên FloraBot. Trạng thái hồ sơ được cập nhật sau khi xác nhận
        giao dịch.
      </p>
    </div>
  );
}
