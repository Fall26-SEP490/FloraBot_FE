import type { KioskApplicationResponse } from '../../installations/installations.types';

interface ApplicationTimelineProps {
  status: KioskApplicationResponse['status'];
  scheduledDate?: string | null;
}

export function ApplicationTimeline({ status, scheduledDate }: ApplicationTimelineProps) {
  return (
    <nav className="kiosk-timeline" aria-label="Tiến độ xử lý hồ sơ">
      <ol className="timeline-steps">
        <li
          className={`timeline-step ${
            ['AWAITING_PAYMENT'].includes(status) ? 'is-current' : 'is-done'
          }`}
        >
          <div className="step-marker" aria-hidden="true">
            1
          </div>
          <div className="step-content">
            <span className="step-title">Thanh toán</span>
            <span className="step-sub">
              {status === 'AWAITING_PAYMENT' ? 'Chờ thanh toán phí' : 'Đã nộp phí thuê'}
            </span>
          </div>
        </li>
        <li
          className={`timeline-step ${
            status === 'PAID_REVIEW' || status === 'UNDER_REVIEW'
              ? 'is-current'
              : ['CONFIRMED', 'SCHEDULED', 'INSTALLING', 'AWAITING_HANDOVER', 'ACTIVE'].includes(
                    status,
                  )
                ? 'is-done'
                : ''
          }`}
        >
          <div className="step-marker" aria-hidden="true">
            2
          </div>
          <div className="step-content">
            <span className="step-title">Xác nhận liên hệ</span>
            <span className="step-sub">
              {status === 'CONFIRMED' ||
              ['SCHEDULED', 'INSTALLING', 'AWAITING_HANDOVER', 'ACTIVE'].includes(status)
                ? 'Quản lý đã duyệt'
                : 'Đang chờ liên hệ'}
            </span>
          </div>
        </li>
        <li
          className={`timeline-step ${
            status === 'CONFIRMED' || status === 'SCHEDULED'
              ? 'is-current'
              : ['INSTALLING', 'AWAITING_HANDOVER', 'ACTIVE'].includes(status)
                ? 'is-done'
                : ''
          }`}
        >
          <div className="step-marker" aria-hidden="true">
            3
          </div>
          <div className="step-content">
            <span className="step-title">Lên lịch lắp đặt</span>
            <span className="step-sub">
              {scheduledDate ? `${scheduledDate}` : 'Chờ phân công KTV'}
            </span>
          </div>
        </li>
        <li
          className={`timeline-step ${
            status === 'INSTALLING'
              ? 'is-current'
              : ['AWAITING_HANDOVER', 'ACTIVE'].includes(status)
                ? 'is-done'
                : ''
          }`}
        >
          <div className="step-marker" aria-hidden="true">
            4
          </div>
          <div className="step-content">
            <span className="step-title">Lắp đặt tại tủ</span>
            <span className="step-sub">
              {status === 'INSTALLING' ? 'KTV đang thi công' : 'Đã chụp minh chứng'}
            </span>
          </div>
        </li>
        <li
          className={`timeline-step ${
            status === 'AWAITING_HANDOVER' ? 'is-current' : status === 'ACTIVE' ? 'is-done' : ''
          }`}
        >
          <div className="step-marker" aria-hidden="true">
            5
          </div>
          <div className="step-content">
            <span className="step-title">Nghiệm thu bàn giao</span>
            <span className="step-sub">
              {status === 'ACTIVE' ? 'Đã kích hoạt shop' : 'Quản lý duyệt ảnh'}
            </span>
          </div>
        </li>
      </ol>
    </nav>
  );
}
