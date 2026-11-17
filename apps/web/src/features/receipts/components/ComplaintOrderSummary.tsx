import type { Ref } from 'react';
import { Button, Flower2 } from '@florabot/ui';
import type { ReceiptData } from '../receipts.types';
import { date } from '../receipts.utils';
import ReceiptContextLink from './ReceiptContextLink';

export default function ComplaintOrderSummary({
  receipt,
  status,
  headingRef,
  pending,
  onRefresh,
  trackingToken,
  returnTo,
}: {
  receipt: ReceiptData;
  status: string;
  headingRef: Ref<HTMLHeadingElement>;
  pending: boolean;
  onRefresh: () => void;
  trackingToken: string;
  returnTo: string | null;
}) {
  return (
    <aside className="receipt-paper complaint-order-paper" aria-label="Đơn hoa đang phản ánh">
      <header className="receipt-paper-brand">
        <div>
          <Flower2 size={26} aria-hidden="true" />
          <strong>FloraBot</strong>
        </div>
        <p>PHIẾU PHẢN ÁNH</p>
      </header>
      <div className="receipt-paper-code">
        <span>Mã đơn hàng</span>
        <h2 id="receipt-result" ref={headingRef} tabIndex={-1}>
          Đơn {receipt.orderCode}
        </h2>
      </div>
      <dl className="receipt-paper-facts">
        <div>
          <dt>Trạng thái</dt>
          <dd>{status}</dd>
        </div>
        {receipt.completedAt && (
          <div>
            <dt>Đã nhận hoa</dt>
            <dd>
              <time dateTime={receipt.completedAt}>{date(receipt.completedAt)}</time>
            </dd>
          </div>
        )}
      </dl>
      <div className="complaint-order-items">
        <h3>Hoa trong đơn</h3>
        <ul>
          {receipt.items.map((item, index) => (
            <li key={index}>
              <span>{item.name}</span>
              <span>× {item.quantity}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="complaint-order-actions">
        <Button type="button" variant="outline" disabled={pending} onClick={onRefresh}>
          Cập nhật trạng thái
        </Button>
        <ReceiptContextLink
          to="/receipt"
          orderId={receipt.orderId}
          trackingToken={trackingToken}
          returnTo={returnTo}
        >
          Xem biên nhận
        </ReceiptContextLink>
      </div>
    </aside>
  );
}
