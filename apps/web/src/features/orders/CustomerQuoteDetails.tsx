import type { ReactNode } from 'react';
import { Check, CheckCircle2, ChevronDown, CircleAlert, Clock, MessageSquare } from '@florabot/ui';
import type { WebOrder } from './orders.types';
import {
  customerOrderHint,
  money,
  orderClosed,
  orderStage,
  statusName,
  when,
} from './orders.utils';
import styles from './customer-orders.module.css';
import { PreorderAccessories } from './PreorderAccessories';
import CustomerPickupGuide from './CustomerPickupGuide';

function exceptionBanner(row: WebOrder): {
  tone: 'warning' | 'danger' | 'neutral' | 'success';
  title: string;
  subtitle: string;
} | null {
  if (row.orderStatus === 'DISPUTED')
    return {
      tone: 'warning',
      title: 'Đơn đang trong quá trình xử lý phản ánh',
      subtitle: customerOrderHint(row),
    };
  if (row.orderStatus === 'DISPENSE_FAILED')
    return {
      tone: 'danger',
      title: 'Giao hoa chưa thành công · Đang chờ xử lý hoàn tiền',
      subtitle: customerOrderHint(row),
    };
  if (row.orderStatus === 'REFUNDED')
    return {
      tone: 'success',
      title: 'Hoàn tiền thành công',
      subtitle: customerOrderHint(row),
    };
  if (row.state === 'REJECTED')
    return {
      tone: 'danger',
      title: 'Shop chưa thể nhận yêu cầu này',
      subtitle: customerOrderHint(row),
    };
  if (row.orderStatus === 'EXPIRED')
    return {
      tone: 'danger',
      title: 'Đã quá thời hạn thanh toán',
      subtitle: customerOrderHint(row),
    };
  if (row.orderStatus === 'CANCELLED' || row.state === 'CANCELLED')
    return {
      tone: 'neutral',
      title: 'Đơn đặt hoa đã hủy',
      subtitle: customerOrderHint(row),
    };
  return null;
}

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
  const hasPrice = row.quotedPrice != null && Number.isFinite(Number(row.quotedPrice));
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

  const banner = exceptionBanner(row);
  const showTimeline = !banner && (!orderClosed(row) || row.orderStatus === 'COMPLETED');
  const stage = orderStage(row);
  const completedAll = row.orderStatus === 'COMPLETED';
  const stepTwoLabel = quoting
    ? expired
      ? 'Báo giá hết hạn'
      : 'Xác nhận báo giá'
    : paying
      ? 'Chờ thanh toán'
      : 'Báo giá & thanh toán';
  const timelineSteps = ['Yêu cầu', stepTwoLabel, 'Chuẩn bị', 'Sẵn sàng nhận', 'Hoàn tất'];

  return (
    <div
      role="region"
      className={styles.shopeeDetailSheet}
      data-actionable={quoting || paying}
      data-pickup={(row.orderStatus === 'PAID' && row.ready) || row.orderStatus === 'DISPENSING'}
      aria-label={
        quoting ? 'Báo giá của shop' : paying ? 'Thông tin thanh toán' : 'Thông tin đơn hoa'
      }
    >
      {showTimeline && (
        <ol className={styles.orderTimeline} aria-label="Tiến độ đơn đặt hoa">
          {timelineSteps.map((label, index) => {
            const done = completedAll || index < stage;
            const current = !completedAll && index === stage;
            return (
              <li
                key={label}
                className={styles.timelineStep}
                data-complete={done || undefined}
                aria-current={current ? 'step' : undefined}
              >
                <span className={styles.timelineDot} aria-hidden="true">
                  {done ? <Check size={13} /> : index + 1}
                </span>
                <span className={styles.timelineLabel}>
                  {label}
                  <span className="sr-only">
                    {done ? ' — đã hoàn thành' : current ? ' — hiện tại' : ' — chưa đến'}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      )}

      {banner && (
        <div className={styles.shopeeStatusNotice} data-tone={banner.tone}>
          <div className={styles.shopeeStatusNoticeHead}>
            {banner.tone === 'success' ? (
              <CheckCircle2 size={18} aria-hidden="true" />
            ) : banner.tone === 'warning' ? (
              <Clock size={18} aria-hidden="true" />
            ) : (
              <CircleAlert size={18} aria-hidden="true" />
            )}
            <strong>{banner.title}</strong>
          </div>
          <p>{banner.subtitle}</p>
        </div>
      )}

      {!banner && row.orderStatus === 'PAID' && (
        <div className={styles.shopeeStatusNotice} data-tone="success" role="status">
          <div className={styles.shopeeStatusNoticeHead}>
            <CheckCircle2 className="payos-confirmed-icon" size={18} aria-hidden="true" />
            <strong>Đã thanh toán</strong>
          </div>
          {!row.ready && <p>Shop đang chuẩn bị hoa.</p>}
        </div>
      )}

      {!banner &&
        (quoting || paying || row.orderStatus === 'COMPLETED' || row.state === 'REQUESTED') && (
          <div
            className={styles.shopeeStatusNotice}
            data-tone={expired ? 'danger' : quoting || paying ? 'warning' : 'neutral'}
          >
            <div className={styles.shopeeStatusNoticeHead}>
              {row.orderStatus === 'COMPLETED' ? (
                <CheckCircle2 size={18} aria-hidden="true" />
              ) : (
                <Clock size={18} aria-hidden="true" />
              )}
              <strong>
                {quoting
                  ? expired
                    ? 'Báo giá đã hết hạn'
                    : 'Shop đã gửi báo giá — chờ bạn xác nhận'
                  : paying
                    ? expired
                      ? 'Đã hết hạn thanh toán'
                      : 'Chờ thanh toán qua PayOS'
                    : row.orderStatus === 'COMPLETED'
                      ? 'Bạn đã nhận hoa thành công'
                      : 'Đang chờ shop báo giá'}
              </strong>
            </div>
            <p>
              {expired
                ? quoting
                  ? 'Hãy liên hệ shop để cập nhật giá và lịch nhận.'
                  : 'Tải lại trang để kiểm tra trạng thái; không thanh toán bằng liên kết cũ.'
                : quoting
                  ? 'Đồng ý báo giá trước, thanh toán ở bước tiếp theo.'
                  : paying
                    ? 'Chọn “Thanh toán ngay” để thanh toán qua PayOS ngay tại đây.'
                    : customerOrderHint(row)}
            </p>
          </div>
        )}

      <CustomerPickupGuide row={row} now={now} contactAction={pickupAction} />

      <div className={styles.shopeeLedgerWrap}>
        <PreorderAccessories row={row} compact />
        <dl className={styles.shopeeLedger}>
          <div className={styles.shopeeLedgerRow}>
            <dt>Tủ nhận hoa</dt>
            <dd>
              <strong>{row.kioskName || 'Chưa có thông tin tủ'}</strong>
              {row.address && <span className={styles.ledgerSub}>{row.address}</span>}
            </dd>
          </div>
          <div className={styles.shopeeLedgerRow}>
            <dt>{row.state === 'REQUESTED' ? 'Giờ nhận mong muốn' : 'Thời gian nhận hoa'}</dt>
            <dd>
              {time(row.pickupAt)}
              {row.pickupBefore && (
                <> – {sameDay ? shortClock(row.pickupBefore) : time(row.pickupBefore)}</>
              )}
            </dd>
          </div>
          <div className={`${styles.shopeeLedgerRow} ${styles.shopeeLedgerTotal}`}>
            <dt>
              {paying
                ? 'Số tiền cần thanh toán'
                : quoting
                  ? 'Tổng báo giá'
                  : hasPrice
                    ? 'Thành tiền'
                    : 'Báo giá'}
            </dt>
            <dd className={!hasPrice ? styles.pricePendingLarge : undefined}>
              {hasPrice ? money(Number(row.quotedPrice)) : 'Chưa có báo giá'}
            </dd>
          </div>
          {(quoting || paying) && (
            <div
              className={`${styles.shopeeLedgerRow} ${styles.shopeeLedgerDeadline}`}
              data-expired={expired || undefined}
            >
              <dt>{quoting ? 'Phản hồi báo giá trước' : 'Thanh toán trước'}</dt>
              <dd>{time(deadline)}</dd>
            </div>
          )}
          {row.orderCode && (
            <div className={styles.shopeeLedgerRow}>
              <dt>Mã đơn hàng</dt>
              <dd className={styles.shopeeLedgerCode}>{row.orderCode}</dd>
            </div>
          )}
        </dl>
      </div>

      {quoting && !hasPrice && (
        <p role="alert" className={styles.expiry}>
          Báo giá chưa có số tiền hợp lệ. Hãy liên hệ shop để kiểm tra trước khi xác nhận.
        </p>
      )}

      {row.quoteNote && (
        <div
          className={styles.shopeeReasonStrip}
          data-rejected={row.state === 'REJECTED' ? 'true' : undefined}
        >
          <strong>
            <MessageSquare size={14} aria-hidden="true" />
            {row.state === 'REJECTED' ? 'Phản hồi của shop:' : 'Ghi chú của shop:'}
          </strong>
          <span>{row.quoteNote}</span>
        </div>
      )}

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
  const tone = failed
    ? 'danger'
    : confirmed
      ? 'success'
      : row?.orderStatus === 'AWAITING_PAYMENT'
        ? 'warning'
        : 'neutral';
  return (
    <div className={styles.paymentReturn} data-tone={tone} role="status" aria-live="polite">
      {confirmed ? (
        <CheckCircle2 size={18} aria-hidden="true" />
      ) : failed ? (
        <CircleAlert size={18} aria-hidden="true" />
      ) : (
        <Clock size={18} aria-hidden="true" />
      )}
      <div>
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
    </div>
  );
}
