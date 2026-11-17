import type { ReactNode } from 'react';
import { CheckCircle2, ChevronDown, Clock } from '@florabot/ui';
import type { WebOrder } from './orders.types';
import { customerOrderHint, money, statusName, when } from './orders.utils';
import styles from './customer-orders.module.css';
import { PreorderAccessories } from './PreorderAccessories';
import CustomerPickupGuide from './CustomerPickupGuide';

export function CustomerQuoteDetails({
  row,
  now,
  pickupAction,
  children,
}: {
  row: WebOrder;
  now: number;
  pickupAction?: ReactNode;
  children?: ReactNode;
}) {
  const quoting = row.state === 'QUOTED' && !row.orderId;
  const paying = row.orderStatus === 'AWAITING_PAYMENT';
  const deadline = quoting ? row.quoteExpiresAt : paying ? row.payBefore : null;
  const expired = Boolean(deadline && new Date(deadline).getTime() <= now);
  const time = (value: string | null | undefined) =>
    value && Number.isFinite(new Date(value).getTime()) ? when(value) : 'Chưa có thông tin';
  const hasPrice = row.quotedPrice != null && Number.isFinite(row.quotedPrice);
  const shortClock = (value: string) =>
    new Date(value).toLocaleTimeString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour: '2-digit',
      minute: '2-digit',
    });
  const sameDay =
    row.pickupBefore &&
    new Date(row.pickupAt).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) ===
      new Date(row.pickupBefore).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
  return (
    <div
      role="region"
      className={styles.quoteReview}
      data-pickup={(row.orderStatus === 'PAID' && row.ready) || row.orderStatus === 'DISPENSING'}
      aria-label={
        quoting ? 'Báo giá của shop' : paying ? 'Thông tin thanh toán' : 'Thông tin đơn hoa'
      }
    >
      <div className={styles.quotePickupBlock}>
        <h3 className={styles.detailHeading}>Thông tin nhận hoa</h3>
        <dl className={styles.quoteFacts}>
          <div>
            <dt>Tủ nhận hoa</dt>
            <dd>
              {row.kioskName || 'Chưa có thông tin tủ'}
              {row.address && <span>{row.address}</span>}
            </dd>
          </div>
          <div>
            <dt>{row.state === 'REQUESTED' ? 'Giờ nhận mong muốn' : 'Thời gian nhận hoa'}</dt>
            <dd>
              {time(row.pickupAt)}
              {row.pickupBefore && (
                <> – {sameDay ? shortClock(row.pickupBefore) : time(row.pickupBefore)}</>
              )}
            </dd>
          </div>
        </dl>
        {row.quoteNote && (
          <div className={styles.quoteNote}>
            <strong>{row.state === 'REJECTED' ? 'Phản hồi của shop' : 'Ghi chú của shop'}</strong>
            <p>{row.quoteNote}</p>
          </div>
        )}
      </div>
      <div className={styles.quoteAmountBlock}>
        <div className={styles.quotePrice}>
          {row.orderStatus === 'PAID' && (
            <p role="status">
              <CheckCircle2 className="payos-confirmed-icon" size={16} aria-hidden="true" />
              <span>
                <b>Đã thanh toán.</b>{' '}
                {row.ready ? 'Hoa đã sẵn sàng tại tủ.' : 'Shop đang chuẩn bị hoa.'}
              </span>
            </p>
          )}
          <span>
            {paying
              ? 'Số tiền cần thanh toán'
              : quoting
                ? 'Tổng báo giá'
                : hasPrice
                  ? 'Giá đã chốt'
                  : 'Báo giá'}
          </span>
          <strong>{hasPrice ? money(row.quotedPrice!) : 'Chưa có báo giá'}</strong>
          {quoting && <p>Đồng ý báo giá trước, thanh toán sau.</p>}
          {paying && <p>Chọn “Thanh toán ngay” để thanh toán qua PayOS ngay tại đây.</p>}
          {!quoting && !paying && row.orderStatus !== 'PAID' && <p>{customerOrderHint(row)}</p>}
        </div>
        <PreorderAccessories row={row} compact />
        {(quoting || paying) && (
          <dl className={styles.quoteFacts}>
            <div className={styles.quoteDeadline}>
              <dt>
                <Clock size={14} aria-hidden="true" />
                {quoting ? 'Phản hồi báo giá trước' : 'Thanh toán trước'}
              </dt>
              <dd>{time(deadline)}</dd>
            </div>
          </dl>
        )}
        {quoting && !hasPrice && (
          <p role="alert" className={styles.expiry}>
            Báo giá chưa có số tiền hợp lệ. Hãy liên hệ shop để kiểm tra trước khi xác nhận.
          </p>
        )}
        {expired && (
          <p role="note" className={styles.expiry}>
            {quoting
              ? 'Báo giá đã hết hạn. Hãy liên hệ shop để cập nhật giá và lịch nhận.'
              : 'Đã hết hạn thanh toán của đơn này. Tải lại trang để kiểm tra trạng thái; không thanh toán bằng liên kết cũ.'}
          </p>
        )}
      </div>
      <CustomerPickupGuide row={row} now={now} contactAction={pickupAction} />
      {row.instructions && (
        <details className={styles.originalRequest}>
          <summary>
            <span>Yêu cầu bạn đã gửi</span>
            <ChevronDown size={16} aria-hidden="true" />
          </summary>
          <p>{row.instructions}</p>
        </details>
      )}
      <div className={styles.interaction}>{children}</div>
    </div>
  );
}

export function CustomerPaymentReturn({
  row,
  loading,
  failed,
}: {
  row?: WebOrder;
  loading: boolean;
  failed: boolean;
}) {
  const confirmed = row && ['PAID', 'DISPENSING', 'COMPLETED'].includes(row.orderStatus ?? '');
  return (
    <div className={styles.paymentReturn} role="status" aria-live="polite">
      <strong>Đã trở về từ payOS.</strong>
      <p>
        {loading
          ? 'Đang kiểm tra trạng thái thanh toán của đơn…'
          : failed
            ? 'Chưa kiểm tra được thanh toán. Tải lại trang để thử lại.'
            : !row
              ? 'Chưa tìm thấy đơn trong trang này. Kiểm tra danh sách đơn hoặc tải lại trang.'
              : confirmed
                ? 'Thanh toán đã được hệ thống xác nhận. Xem lịch nhận và tiến độ đơn bên dưới.'
                : row.orderStatus === 'AWAITING_PAYMENT'
                  ? 'Hệ thống chưa xác nhận thanh toán. Nếu đã trả tiền, chờ cập nhật hoặc tải lại trang; đừng thanh toán lại ngay.'
                  : `Trạng thái hiện tại: ${statusName(row)}. Xem chi tiết đơn bên dưới.`}
      </p>
    </div>
  );
}
