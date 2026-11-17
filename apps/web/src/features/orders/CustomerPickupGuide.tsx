import { useState, type ReactNode } from 'react';
import { Button, ChevronDown, Clock, HelpCircle, KeyRound } from '@florabot/ui';
import type { WebOrder } from './orders.types';
import { when } from './orders.utils';
import styles from './customer-orders.module.css';

import { pickupWindow } from './pickup-window';

export default function CustomerPickupGuide({
  row,
  now,
  contactAction,
}: {
  row: WebOrder;
  now: number;
  contactAction?: ReactNode;
}) {
  const [copied, setCopied] = useState<'' | 'orderId' | 'token'>('');
  const [copyError, setCopyError] = useState('');
  const ready = row.orderStatus === 'PAID' && row.ready;
  if (!ready && row.orderStatus !== 'DISPENSING') return null;
  const timing = pickupWindow(row.pickupAt, row.pickupBefore, now);
  const canPlanPickup = timing === 'early' || timing === 'within';
  const { orderId, trackingToken } = row;
  async function copy(value: string, field: 'orderId' | 'token') {
    setCopyError('');
    setCopied('');
    try {
      await navigator.clipboard.writeText(value);
      setCopied(field);
    } catch {
      setCopyError('Chưa sao chép được. Bạn có thể chọn và sao chép mã trực tiếp.');
    }
  }
  return (
    <section className={styles.pickupGuide} aria-label="Hướng dẫn nhận hoa">
      <h3>
        <KeyRound size={18} aria-hidden="true" />
        {ready ? 'Nhận hoa tại kiosk' : 'Kiosk đang xử lý nhận hoa'}
      </h3>
      <div className={styles.pickupInstructions}>
        {ready ? (
          <>
            {timing !== 'within' && (
              <div className={styles.pickupNotice} data-warning={!canPlanPickup}>
                <Clock size={17} aria-hidden="true" />
                <div>
                  <strong>
                    {timing === 'early'
                      ? 'Chưa đến giờ nhận'
                      : timing === 'expired'
                        ? 'Đã qua giờ nhận trên đơn'
                        : 'Chưa xác định được giờ nhận'}
                  </strong>
                  <p>
                    {timing === 'early'
                      ? `Bạn có thể đến kiosk từ ${when(row.pickupAt)}.`
                      : 'Nhắn shop về đơn này trước khi đến kiosk.'}
                  </p>
                  {!canPlanPickup && contactAction}
                </div>
              </div>
            )}
            {canPlanPickup && (
              <>
                <ol className={styles.pickupSteps}>
                  <li>Đến đúng kiosk trong giờ nhận trên đơn.</li>
                  <li>
                    Trên màn hình kiosk, chọn <strong>Nhận đơn đặt trước</strong>.
                  </li>
                  <li>
                    Nhập <strong>OTP 8 chữ số</strong> gửi đến email đăng nhập.
                  </li>
                </ol>
                <p className={styles.pickupHelp}>
                  Chưa thấy OTP? Kiểm tra thư rác hoặc nhắn shop để được hỗ trợ.
                </p>
              </>
            )}
          </>
        ) : (
          <p className={styles.pickupHelp}>
            Chờ trạng thái đơn cập nhật. Nếu kiosk không giao hoa, giữ biên nhận và nhắn shop để
            được hỗ trợ.
          </p>
        )}
      </div>
      {row.ready && orderId && trackingToken && (
        <details className={styles.pickupRecovery} aria-label="Thông tin nhận hoa tại Kiosk">
          <summary>
            <HelpCircle size={17} aria-hidden="true" />
            <span>Chưa nhận được hoa?</span>
            <ChevronDown size={16} aria-hidden="true" />
          </summary>
          <div className={styles.pickupRecoveryBody}>
            <p>
              Tại kiosk, chỉ dùng hai mã này trong mục “Đã thanh toán nhưng chưa nhận hoa?”. Mã tra
              cứu không phải OTP trong email.
            </p>
            <dl className={styles.pickupCodes}>
              <div>
                <dt>ID biên nhận</dt>
                <dd>
                  <code>{orderId}</code>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void copy(orderId, 'orderId')}
                  >
                    {copied === 'orderId' ? 'Đã chép ID' : 'Sao chép ID'}
                  </Button>
                </dd>
              </div>
              <div>
                <dt>Mã tra cứu</dt>
                <dd>
                  <code>{trackingToken}</code>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void copy(trackingToken, 'token')}
                  >
                    {copied === 'token' ? 'Đã chép mã' : 'Sao chép mã'}
                  </Button>
                </dd>
              </div>
            </dl>
            <p className={styles.pickupCopyStatus} role="status">
              {copyError || (copied ? 'Đã sao chép vào bộ nhớ tạm.' : '')}
            </p>
          </div>
        </details>
      )}
    </section>
  );
}
