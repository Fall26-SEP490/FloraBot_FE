import { CircleAlert } from '@florabot/ui';
import type { KioskApplicationResponse } from '../../installations/installations.types';

interface ApplicationStatusActionsProps {
  appData: KioskApplicationResponse;
}

export function ApplicationStatusActions({ appData }: ApplicationStatusActionsProps) {
  if (appData.status === 'PAID_REVIEW') {
    return (
      <div className="status-action-box" data-action="paid-review">
        <h3>Đã thanh toán thành công</h3>
        <p>
          Khoản phí thuê {Number(appData.annualFee).toLocaleString('vi-VN')} đ đã được ghi nhận.
          Quản lý vận hành FloraBot sẽ liên hệ với bạn qua số điện thoại{' '}
          <strong>{appData.phone}</strong> để xác nhận địa điểm trước khi tiến hành lên lịch lắp
          đặt.
        </p>
        <p className="kiosk-help-text">
          Trong giai đoạn này, bạn vẫn có thể hủy hồ sơ nếu thay đổi kế hoạch. Khoản tiền sẽ được
          chuyển sang quy trình hoàn tiền thủ công của Quản trị viên.
        </p>
      </div>
    );
  }

  if (appData.status === 'SCHEDULED') {
    return (
      <div className="status-action-box" data-action="scheduled">
        <h3>Lịch lắp đặt đã được ấn định</h3>
        <dl className="kiosk-detail-list">
          <div>
            <dt>Ngày dự kiến:</dt>
            <dd>
              <strong>{appData.scheduledDate || 'Đang cập nhật'}</strong>
            </dd>
          </div>
          <div>
            <dt>Khung giờ:</dt>
            <dd>
              <strong>{appData.timeWindow || 'Trong giờ hành chính'}</strong>
            </dd>
          </div>
          <div>
            <dt>Mã tủ phân bổ:</dt>
            <dd>
              <code>{appData.assignedKioskCode || 'Đang cấp phát'}</code>
            </dd>
          </div>
          <div>
            <dt>Kỹ thuật viên phụ trách:</dt>
            <dd>{appData.assignedTechnicianName || 'Kỹ thuật viên FloraBot'}</dd>
          </div>
        </dl>
        <p className="kiosk-help-text">
          Kỹ thuật viên sẽ liên hệ trước khi đến địa chỉ lắp đặt. Vui lòng đảm bảo điểm đặt có nguồn
          điện khả dụng.
        </p>
      </div>
    );
  }

  if (appData.status === 'INSTALLING') {
    return (
      <div className="status-action-box" data-action="installing">
        <h3>Kỹ thuật viên đang tiến hành lắp đặt</h3>
        <p>
          Kỹ thuật viên đang kiểm tra cảm biến cửa, kết nối tủ và tải lên hình ảnh minh chứng hiện
          trường.
        </p>
        {appData.reworkReason && (
          <div role="alert" className="kiosk-field-error-banner">
            <CircleAlert size={18} aria-hidden="true" />
            <div>
              <strong>Yêu cầu chỉnh sửa / kiểm tra lại từ quản lý:</strong>
              <p>{appData.reworkReason}</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (appData.status === 'AWAITING_HANDOVER') {
    return (
      <div className="status-action-box" data-action="handover">
        <h3>Đã hoàn tất lắp đặt - Chờ nghiệm thu bàn giao</h3>
        <p>
          Kỹ thuật viên đã nộp báo cáo hoàn thành cùng hình ảnh minh chứng. Quản lý vận hành đang
          kiểm tra hồ sơ để kích hoạt quyền Chủ shop và bắt đầu kỳ hạn 1 năm của bạn.
        </p>
      </div>
    );
  }

  if (appData.status === 'REFUND_PENDING') {
    return (
      <div className="status-action-box" data-action="refund-pending">
        <h3>Đang xử lý hoàn tiền</h3>
        <p>
          Hồ sơ đã được chuyển sang danh sách hoàn tiền thủ công. Quản trị viên sẽ kiểm tra và
          chuyển khoản số tiền {Number(appData.annualFee).toLocaleString('vi-VN')} đ về tài khoản{' '}
          <strong>
            {appData.bankName} - ****{appData.bankAccountSuffix}
          </strong>{' '}
          ({appData.bankHolder}).
        </p>
      </div>
    );
  }

  return null;
}
