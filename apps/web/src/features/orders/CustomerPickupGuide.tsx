import { useState } from 'react';
import { Button } from '@florabot/ui';
import type { WebOrder } from './orders.types';
import { when } from './orders.utils';
import styles from './customer-orders.module.css';

import { pickupWindow } from './pickup-window';

export default function CustomerPickupGuide({ row, now }: { row: WebOrder; now: number }) {
  const [copied, setCopied] = useState<'' | 'orderId' | 'token'>('');
  const [copyError, setCopyError] = useState('');
  const ready = row.orderStatus === 'PAID' && row.ready;
  if (!ready && row.orderStatus !== 'DISPENSING') return null;
  const window = pickupWindow(row.pickupAt, row.pickupBefore, now);
  async function copy(value: string, field: 'orderId' | 'token') {
    setCopyError('');
    try {
      await navigator.clipboard.writeText(value);
      setCopied(field);
    } catch {
      setCopyError('Chưa sao chép được. Bạn có thể chọn và sao chép mã trực tiếp.');
    }
  }
  return (
    <div className={styles.pickupGuide} role="region" aria-label="Hướng dẫn nhận hoa">
      <h3>{ready ? 'Nhận hoa bằng OTP trong email' : 'Kiosk đang xử lý nhận hoa'}</h3>
      {ready ? (
        <>
          {window === 'early' && (
            <p className={styles.pickupNotice}>
              Chưa đến giờ nhận. Bạn có thể đến tủ từ {when(row.pickupAt)}.
            </p>
          )}
          {window === 'expired' && (
            <p className={styles.pickupNotice}>
              Đã qua giờ nhận trên đơn. Làm mới trạng thái và liên hệ shop để được hướng dẫn trước
              khi đến tủ.
            </p>
          )}
          {window === 'unknown' && (
            <p className={styles.pickupNotice}>
              Chưa có khung giờ nhận đầy đủ. Kiểm tra lại với shop trước khi đến tủ.
            </p>
          )}
          <ol className={styles.pickupSteps}>
            <li>Kiểm tra địa chỉ tủ và khung giờ nhận trên đơn.</li>
            <li>Tại kiosk, chọn “Nhận đơn đặt trước”.</li>
            <li>Nhập OTP 8 chữ số được gửi tới email đăng nhập của bạn.</li>
          </ol>
          <p className={styles.pickupHelp}>
            Chưa thấy OTP? Kiểm tra thư rác hoặc nhắn shop để được hỗ trợ gửi lại.
          </p>
        </>
      ) : (
        <p>
          Chờ kết quả cập nhật trên đơn. Nếu tủ không giao hoa, giữ biên nhận để được hỗ trợ; không
          thực hiện nhận lại liên tục.
        </p>
      )}
      {row.ready && row.orderId && row.trackingToken && (
        <details className={styles.pickupRecovery} aria-label="Thông tin nhận hoa tại Kiosk">
          <summary>Hỗ trợ khi đã thanh toán nhưng chưa nhận được hoa</summary>
          <p>
            Mã tra cứu biên nhận dưới đây không phải OTP trong email. Chỉ dùng khi màn hình kiosk
            yêu cầu ID biên nhận và mã tra cứu tại mục “Đã thanh toán nhưng chưa nhận hoa?”. Giữ
            riêng hai mã này.
          </p>
          <dl>
            <div>
              <dt>ID biên nhận (nhập tại Kiosk)</dt>
              <dd>
                <code>{row.orderId}</code>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void copy(row.orderId!, 'orderId')}
                >
                  {copied === 'orderId' ? 'Đã chép ID' : 'Sao chép ID'}
                </Button>
              </dd>
            </div>
            <div>
              <dt>Mã biên nhận 8 ký tự</dt>
              <dd>
                <code>{row.trackingToken}</code>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void copy(row.trackingToken!, 'token')}
                >
                  {copied === 'token' ? 'Đã chép mã' : 'Sao chép mã'}
                </Button>
              </dd>
            </div>
          </dl>
          <p role="status">{copyError || (copied ? 'Đã sao chép mã vào bộ nhớ tạm.' : '')}</p>
        </details>
      )}
    </div>
  );
}
