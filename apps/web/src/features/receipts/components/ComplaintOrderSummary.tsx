import type { Ref } from 'react';
import { Button } from '@florabot/ui';
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
        <span className="receipt-paper-emblem" aria-hidden="true">
          <img src="/favicon-rose.png" alt="" width={38} height={38} />
        </span>
        <strong>FloraBot</strong>
        <p>PHIẾU PHẢN ÁNH</p>
      </header>
      <div className="receipt-paper-meta complaint-order-meta">
        <div className="complaint-meta-full">
          <span className="receipt-meta-label">Mã đơn hàng</span>
          <h2 id="receipt-result" ref={headingRef} tabIndex={-1}>
            Đơn {receipt.orderCode}
          </h2>
        </div>
        <div>
          <span className="receipt-meta-label">Trạng thái</span>
          <p className="receipt-meta-value">
            <span className="receipt-status" data-status={receipt.status}>
              {status}
            </span>
          </p>
        </div>
        {receipt.completedAt && (
          <div>
            <span className="receipt-meta-label">Nhận hoa lúc</span>
            <p className="receipt-meta-value">
              <time dateTime={receipt.completedAt}>{date(receipt.completedAt)}</time>
            </p>
          </div>
        )}
      </div>
      <div className="complaint-order-items">
        <h3 className="sr-only">Hoa trong đơn</h3>
        <div className="complaint-items-head" aria-hidden="true">
          <span>STT</span>
          <span>Hoa trong đơn</span>
          <span>SL</span>
        </div>
        <ul>
          {receipt.items.map((item, index) => (
            <li key={index}>
              <span className="receipt-item-no">{index + 1}</span>
              <span className="complaint-item-name">{item.name}</span>
              <span className="complaint-item-qty">{item.quantity}</span>
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
