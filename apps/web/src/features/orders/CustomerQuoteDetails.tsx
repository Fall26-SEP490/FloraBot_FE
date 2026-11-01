import type { WebOrder } from './orders.types';
import { money, statusName, when } from './orders.utils';
import styles from './customer-orders.module.css';

export function CustomerQuoteDetails({ row, now }: { row: WebOrder; now: number }) {
  const quoting = row.state === 'QUOTED' && !row.orderId;
  const paying = row.orderStatus === 'AWAITING_PAYMENT';
  const deadline = quoting ? row.quoteExpiresAt : paying ? row.payBefore : null;
  const expired = Boolean(deadline && new Date(deadline).getTime() <= now);
  const time = (value: string | null | undefined) =>
    value && Number.isFinite(new Date(value).getTime()) ? when(value) : 'Chưa có thông tin';
  const hasPrice = row.quotedPrice != null && Number.isFinite(row.quotedPrice);
  return (
    <div
      role="region"
      className={styles.quoteReview}
      aria-label={
        quoting ? 'Báo giá của shop' : paying ? 'Thông tin thanh toán' : 'Thông tin đơn hoa'
      }
    >
      <div className={styles.quotePrice}>
        <span>{paying ? 'Số tiền cần thanh toán' : quoting ? 'Giá shop báo' : 'Giá đã chốt'}</span>
        <strong>{hasPrice ? money(row.quotedPrice!) : 'Chưa có báo giá'}</strong>
        {quoting && <p>Đồng ý báo giá trước, thanh toán sau.</p>}
        {paying && <p>Chọn “Thanh toán ngay” để mở trang payOS.</p>}
      </div>
      <dl className={styles.quoteFacts}>
        <div>
          <dt>Cửa hàng</dt>
          <dd>{row.shopName || 'Shop chưa cập nhật tên'}</dd>
        </div>
        <div>
          <dt>Tủ nhận hoa</dt>
          <dd>
            {row.kioskName || 'Chưa có thông tin tủ'}
            {row.address && <span>{row.address}</span>}
          </dd>
        </div>
        <div>
          <dt>{row.state === 'REQUESTED' ? 'Giờ nhận mong muốn' : 'Nhận từ'}</dt>
          <dd>{time(row.pickupAt)}</dd>
        </div>
        {row.pickupBefore && (
          <div>
            <dt>Nhận trước</dt>
            <dd>{time(row.pickupBefore)}</dd>
          </div>
        )}
        {(quoting || paying) && (
          <div className={styles.quoteDeadline}>
            <dt>{quoting ? 'Phản hồi báo giá trước' : 'Thanh toán trước'}</dt>
            <dd>{time(deadline)}</dd>
          </div>
        )}
      </dl>
      {row.quoteNote && (
        <div className={styles.quoteNote}>
          <strong>Ghi chú của shop</strong>
          <p>{row.quoteNote}</p>
        </div>
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
            : 'Đã hết hạn thanh toán của đơn này. Làm mới để kiểm tra trạng thái; không thanh toán bằng liên kết cũ.'}
        </p>
      )}
      {row.instructions && (
        <details className={styles.originalRequest}>
          <summary>Yêu cầu bạn đã gửi</summary>
          <p>{row.instructions}</p>
        </details>
      )}
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
            ? 'Chưa kiểm tra được thanh toán. Chọn Làm mới để thử lại.'
            : !row
              ? 'Chưa tìm thấy đơn trong trang này. Kiểm tra danh sách đơn hoặc chọn Làm mới.'
              : confirmed
                ? 'Thanh toán đã được hệ thống xác nhận. Xem lịch nhận và tiến độ đơn bên dưới.'
                : row.orderStatus === 'AWAITING_PAYMENT'
                  ? 'Hệ thống chưa xác nhận thanh toán. Nếu đã trả tiền, chờ cập nhật hoặc chọn Làm mới; đừng thanh toán lại ngay.'
                  : `Trạng thái hiện tại: ${statusName(row)}. Xem chi tiết đơn bên dưới.`}
      </p>
    </div>
  );
}
