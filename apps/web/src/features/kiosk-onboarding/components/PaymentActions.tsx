import { Banknote, Button, CircleAlert, RefreshCw } from '@florabot/ui';

interface PaymentActionsProps {
  packageName: string;
  annualFee: number | string;
  validatedCheckoutUrl: string | null;
  paymentLinkError: string;
  isGeneratingLink: boolean;
  isReconciling: boolean;
  onGenerateLink: () => void;
  onReconcile: () => void;
}

export function PaymentActions({
  packageName,
  annualFee,
  validatedCheckoutUrl,
  paymentLinkError,
  isGeneratingLink,
  isReconciling,
  onGenerateLink,
  onReconcile,
}: PaymentActionsProps) {
  return (
    <div className="status-action-box" data-action="payment">
      <h3>Thanh toán phí thuê gói {packageName}</h3>
      <p>
        Số tiền: <strong>{Number(annualFee).toLocaleString('vi-VN')} đ</strong> (cho thời hạn trọn
        gói 1 năm, tính từ khi bàn giao).
      </p>

      {paymentLinkError && (
        <div role="alert" className="kiosk-field-error-banner">
          <CircleAlert size={18} aria-hidden="true" />
          <span>{paymentLinkError}</span>
        </div>
      )}

      {validatedCheckoutUrl && (
        <div className="payment-ready-box" role="status">
          <p>Liên kết thanh toán payOS đã sẵn sàng:</p>
          <a
            href={validatedCheckoutUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="button button-primary payos-checkout-link"
          >
            <Banknote size={18} aria-hidden="true" />
            Mở trang thanh toán pay.payos.vn (Tab mới)
          </a>
        </div>
      )}

      <div className="action-buttons-row">
        <Button onClick={onGenerateLink} disabled={isGeneratingLink}>
          <Banknote size={18} aria-hidden="true" />
          {isGeneratingLink ? 'Đang tạo liên kết...' : 'Tạo liên kết thanh toán payOS'}
        </Button>
        <Button variant="outline" onClick={onReconcile} disabled={isReconciling}>
          <RefreshCw className={isReconciling ? 'kiosk-spin' : ''} size={18} aria-hidden="true" />
          Kiểm tra thanh toán (Đối soát máy chủ)
        </Button>
      </div>

      <p className="kiosk-help-text">
        FloraBot xác thực thanh toán trực tiếp qua máy chủ cổng payOS. Trình duyệt không tự quyết
        định trạng thái thanh toán từ query trả về.
      </p>
    </div>
  );
}
