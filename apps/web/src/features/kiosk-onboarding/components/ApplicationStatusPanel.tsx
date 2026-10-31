import { Button, CircleAlert } from '@florabot/ui';
import type { KioskApplicationResponse } from '../../installations/installations.types';
import { KIOSK_STATUS_LABELS } from '../../installations/installations.constants';
import { ActiveSellerPanel } from './ActiveSellerPanel';
import { ApplicationStatusActions } from './ApplicationStatusActions';
import { ApplicationTimeline } from './ApplicationTimeline';
import { PaymentActions } from './PaymentActions';

interface ApplicationStatusPanelProps {
  appData: KioskApplicationResponse;
  onOpenCancelDialog: () => void;
  reconcileNotice: string;
  validatedCheckoutUrl: string | null;
  paymentLinkError: string;
  isGeneratingLink: boolean;
  isReconciling: boolean;
  onGenerateLink: () => void;
  onReconcile: () => void;
  refreshingSession: boolean;
  refreshError: string | null;
  onRefreshSession: () => void;
}

export function ApplicationStatusPanel({
  appData,
  onOpenCancelDialog,
  reconcileNotice,
  validatedCheckoutUrl,
  paymentLinkError,
  isGeneratingLink,
  isReconciling,
  onGenerateLink,
  onReconcile,
  refreshingSession,
  refreshError,
  onRefreshSession,
}: ApplicationStatusPanelProps) {
  return (
    <section
      className="kiosk-application-status-panel"
      aria-labelledby="application-status-heading"
    >
      <div className="status-panel-header">
        <div>
          <span className="kiosk-status-pill" data-status={appData.status}>
            {KIOSK_STATUS_LABELS[appData.status] || appData.status}
          </span>
          <h2 id="application-status-heading">Hồ sơ thuê: {appData.shopName}</h2>
          <p className="status-meta">
            Mã hồ sơ: <code>{appData.id.slice(0, 8)}</code> · Gói:{' '}
            <strong>{appData.packageName}</strong> (
            {Number(appData.annualFee).toLocaleString('vi-VN')} đ/năm) · Tạo lúc:{' '}
            {new Date(appData.createdAt).toLocaleDateString('vi-VN')}
          </p>
        </div>
        {appData.canVoluntaryCancel && (
          <Button variant="outline" className="cancel-app-btn" onClick={onOpenCancelDialog}>
            Hủy hồ sơ
          </Button>
        )}
      </div>

      {/* Progress Timeline */}
      <ApplicationTimeline status={appData.status} scheduledDate={appData.scheduledDate} />

      {/* Locked voluntary cancellation explanation */}
      {!appData.canVoluntaryCancel &&
        ['CONFIRMED', 'SCHEDULED', 'INSTALLING', 'AWAITING_HANDOVER'].includes(appData.status) && (
          <div className="status-notice notice-info" role="status">
            <CircleAlert size={18} aria-hidden="true" />
            <p>
              <strong>Lưu ý:</strong> Quản lý vận hành đã liên hệ xác nhận và khóa việc tự ý hủy hồ
              sơ để chuẩn bị thiết bị kiosk và kỹ thuật viên. Nếu có sự cố bất khả kháng, quản lý
              vận hành sẽ hỗ trợ xử lý ngoại lệ.
            </p>
          </div>
        )}

      {/* Reconcile notice banner */}
      {reconcileNotice && (
        <div role="status" className="status-notice notice-info" style={{ marginBottom: '1rem' }}>
          <CircleAlert size={18} aria-hidden="true" />
          <span>{reconcileNotice}</span>
        </div>
      )}

      {/* State Specific Callouts */}
      {appData.status === 'AWAITING_PAYMENT' && (
        <PaymentActions
          packageName={appData.packageName}
          annualFee={appData.annualFee}
          validatedCheckoutUrl={validatedCheckoutUrl}
          paymentLinkError={paymentLinkError}
          isGeneratingLink={isGeneratingLink}
          isReconciling={isReconciling}
          onGenerateLink={onGenerateLink}
          onReconcile={onReconcile}
        />
      )}

      {appData.status === 'ACTIVE' && (
        <ActiveSellerPanel
          refreshingSession={refreshingSession}
          refreshError={refreshError}
          onRefreshSession={onRefreshSession}
        />
      )}

      {appData.status !== 'AWAITING_PAYMENT' && appData.status !== 'ACTIVE' && (
        <ApplicationStatusActions appData={appData} />
      )}

      {/* Application Details Summary */}
      <details className="kiosk-app-summary-details">
        <summary>Xem lại thông tin đã đăng ký trong hồ sơ</summary>
        <div className="kiosk-summary-grid">
          <div>
            <strong>Điểm lắp đặt:</strong>
            <p>{appData.installationAddress}</p>
            <small>
              Tọa độ: {Number(appData.latitude).toFixed(6)}, {Number(appData.longitude).toFixed(6)}
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
            <small>Chỉ dùng để nhận tiền bán hoa, không ủy quyền trích nợ.</small>
          </div>
          <div>
            <strong>Sức chứa kiosk:</strong>
            <p>{appData.totalSlots} ô tủ</p>
          </div>
        </div>
      </details>
    </section>
  );
}
