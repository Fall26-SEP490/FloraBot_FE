import { Button, CircleAlert, RefreshCw } from '@florabot/ui';
import type { KioskApplicationResponse } from '../../installations/installations.types';
import { KIOSK_STATUS_LABELS } from '../../installations/installations.constants';

interface TerminalApplicationPanelProps {
  appData: KioskApplicationResponse;
  reconcileNotice: string;
  isReconciling: boolean;
  onReconcile: () => void;
}

export function TerminalApplicationPanel({
  appData,
  reconcileNotice,
  isReconciling,
  onReconcile,
}: TerminalApplicationPanelProps) {
  if (appData.status === 'CANCELLED' || appData.status === 'REJECTED') {
    return (
      <section
        className="kiosk-last-app-panel"
        aria-labelledby="last-application-heading"
        style={{ marginBottom: '1.5rem' }}
      >
        <div
          className="status-notice notice-info"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div>
            <h2
              id="last-application-heading"
              style={{ fontSize: '1.05rem', margin: 0, fontWeight: 700 }}
            >
              Hồ sơ trước ({appData.shopName}):{' '}
              {KIOSK_STATUS_LABELS[appData.status] || appData.status}
            </h2>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.88rem' }}>
              Mã hồ sơ: <code>{appData.id.slice(0, 8)}</code> · Gói:{' '}
              <strong>{appData.packageName}</strong> (
              {Number(appData.annualFee).toLocaleString('vi-VN')} đ/năm) · Tạo lúc:{' '}
              {new Date(appData.createdAt).toLocaleDateString('vi-VN')}
            </p>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.88rem' }}>
              Nếu bạn đã chuyển khoản thành công trước đó, bạn có thể yêu cầu máy chủ kiểm tra lại
              với cổng thanh toán để tự động chuyển sang hoàn tiền.
            </p>
          </div>
          <Button variant="outline" onClick={onReconcile} disabled={isReconciling}>
            <RefreshCw className={isReconciling ? 'kiosk-spin' : ''} size={16} aria-hidden="true" />
            {isReconciling ? 'Đang đối soát...' : 'Kiểm tra thanh toán muộn'}
          </Button>
        </div>
        {reconcileNotice && (
          <div role="status" className="status-notice notice-info" style={{ marginTop: '0.75rem' }}>
            <CircleAlert size={18} aria-hidden="true" />
            <span>{reconcileNotice}</span>
          </div>
        )}
        <details className="kiosk-app-summary-details" style={{ marginTop: '0.75rem' }}>
          <summary>Xem lại thông tin đã đăng ký trong hồ sơ trước</summary>
          <div className="kiosk-summary-grid">
            <div>
              <strong>Điểm lắp đặt:</strong>
              <p>{appData.installationAddress}</p>
              <small>
                Tọa độ: {Number(appData.latitude).toFixed(6)},{' '}
                {Number(appData.longitude).toFixed(6)}
              </small>
            </div>
            <div>
              <strong>Liên hệ:</strong>
              <p>
                {appData.phone} · {appData.contactEmail}
              </p>
            </div>
            <div>
              <strong>Tài khoản nhận doanh thu shop:</strong>
              <p>
                {appData.bankName} - ****{appData.bankAccountSuffix} ({appData.bankHolder})
              </p>
            </div>
            <div>
              <strong>Sức chứa tủ:</strong>
              <p>
                {appData.totalSlots} ô tủ. Shop cấu hình ô mua tại chỗ và đặt trước sau khi bàn
                giao.
              </p>
            </div>
          </div>
        </details>
      </section>
    );
  }

  if (appData.status === 'REFUNDED') {
    return (
      <section
        className="kiosk-last-app-panel"
        aria-labelledby="last-application-heading"
        style={{ marginBottom: '1.5rem' }}
      >
        <div
          className="status-notice notice-info"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div>
            <h2
              id="last-application-heading"
              style={{ fontSize: '1.05rem', margin: 0, fontWeight: 700 }}
            >
              Hồ sơ trước ({appData.shopName}):{' '}
              {KIOSK_STATUS_LABELS[appData.status] || 'Đã hoàn tiền'}
            </h2>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.88rem' }}>
              Mã hồ sơ: <code>{appData.id.slice(0, 8)}</code> · Gói:{' '}
              <strong>{appData.packageName}</strong> (
              {Number(appData.annualFee).toLocaleString('vi-VN')} đ/năm) · Tạo lúc:{' '}
              {new Date(appData.createdAt).toLocaleDateString('vi-VN')}
            </p>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.88rem' }}>
              Khoản phí thuê đã được Quản trị viên chuyển khoản hoàn trả về tài khoản{' '}
              <strong>
                {appData.bankName} - ****{appData.bankAccountSuffix}
              </strong>{' '}
              ({appData.bankHolder}). Bạn có thể nộp hồ sơ thuê mới bất cứ lúc nào bên dưới.
            </p>
          </div>
          <span className="kiosk-status-pill" data-status="REFUNDED">
            {KIOSK_STATUS_LABELS.REFUNDED || 'Đã hoàn tiền'}
          </span>
        </div>
        <details className="kiosk-app-summary-details" style={{ marginTop: '0.75rem' }}>
          <summary>Xem lại thông tin đã đăng ký trong hồ sơ trước</summary>
          <div className="kiosk-summary-grid">
            <div>
              <strong>Điểm lắp đặt:</strong>
              <p>{appData.installationAddress}</p>
              <small>
                Tọa độ: {Number(appData.latitude).toFixed(6)},{' '}
                {Number(appData.longitude).toFixed(6)}
              </small>
            </div>
            <div>
              <strong>Liên hệ:</strong>
              <p>
                {appData.phone} · {appData.contactEmail}
              </p>
            </div>
            <div>
              <strong>Tài khoản nhận doanh thu shop:</strong>
              <p>
                {appData.bankName} - ****{appData.bankAccountSuffix} ({appData.bankHolder})
              </p>
            </div>
            <div>
              <strong>Sức chứa tủ:</strong>
              <p>
                {appData.totalSlots} ô tủ. Shop cấu hình ô mua tại chỗ và đặt trước sau khi bàn
                giao.
              </p>
            </div>
          </div>
        </details>
      </section>
    );
  }

  return null;
}
