import Link from 'next/link';
import { ArrowRight, Button, Check, CircleAlert } from '@florabot/ui';

interface ActiveSellerPanelProps {
  refreshingSession: boolean;
  refreshError: string | null;
  onRefreshSession: () => void;
}

export function ActiveSellerPanel({
  refreshingSession,
  refreshError,
  onRefreshSession,
}: ActiveSellerPanelProps) {
  return (
    <div className="status-action-box active-success-banner" data-action="active">
      <div className="active-success-header">
        <Check size={28} aria-hidden="true" />
        <div>
          <h3>Kiosk đã kích hoạt thành công!</h3>
          <p>
            Chúc mừng bạn đã chính thức trở thành Chủ shop trên FloraBot. Thời hạn thuê 1 năm bắt
            đầu từ hôm nay.
          </p>
        </div>
      </div>

      <div className="action-buttons-row">
        <Button onClick={onRefreshSession} disabled={refreshingSession}>
          <ArrowRight size={18} aria-hidden="true" />
          {refreshingSession ? 'Đang chuyển vào shop...' : 'Vào quản lý Shop & Mẫu hoa'}
        </Button>
      </div>

      {refreshError && (
        <div role="alert" className="kiosk-field-error-banner" style={{ marginTop: '0.75rem' }}>
          <CircleAlert size={18} aria-hidden="true" />
          <div>
            <span>{refreshError}</span>
            <div style={{ marginTop: '0.5rem' }}>
              <Link href="/dang-nhap" className="button button-outline">
                Đăng nhập lại
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
