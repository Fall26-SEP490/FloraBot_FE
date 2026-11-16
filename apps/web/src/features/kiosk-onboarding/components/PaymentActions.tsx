import { Banknote, Button, CircleAlert, RefreshCw } from '@florabot/ui';

interface PaymentActionsProps {
  annualFee: number | string;
  paymentLinkError: string;
  isGeneratingLink: boolean;
  isReconciling: boolean;
  onGenerateLink: () => void;
  onReconcile: () => void;
}

export function PaymentActions({
  annualFee,
  paymentLinkError,
  isGeneratingLink,
  isReconciling,
  onGenerateLink,
  onReconcile,
}: PaymentActionsProps) {
  return (
    <div className="status-action-box" data-action="payment">
      <h3>Thanh toán phí thuê kiosk</h3>
      <p>Hồ sơ đã gửi. Thanh toán để FloraBot tiếp tục xử lý.</p>
      <p>
        Số tiền: <strong>{Number(annualFee).toLocaleString('vi-VN')} đ</strong>
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
          {isGeneratingLink ? 'Đang tải mã QR…' : 'Thanh toán phí thuê'}
        </Button>
        <Button variant="outline" onClick={onReconcile} disabled={isReconciling}>
          <RefreshCw className={isReconciling ? 'kiosk-spin' : ''} size={18} aria-hidden="true" />
          Kiểm tra thanh toán
        </Button>
      </div>

      <p className="kiosk-help-text">
        Quét mã QR bằng ứng dụng ngân hàng ngay trên FloraBot. Trạng thái hồ sơ được cập nhật sau
        khi xác nhận giao dịch.
      </p>
    </div>
  );
}
