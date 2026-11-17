import type { Ref } from 'react';
import { Flower2 } from '@florabot/ui';
import type { ReceiptData } from '../receipts.types';
import { date, money } from '../receipts.utils';

export default function ReceiptPaper({
  receipt,
  status,
  headingRef,
}: {
  receipt: ReceiptData;
  status: string;
  headingRef: Ref<HTMLHeadingElement>;
}) {
  const refundRelated = ['DISPENSE_FAILED', 'DISPUTED', 'REFUNDED'].includes(receipt.status);
  return (
    <article className="receipt-paper" aria-label="Biên nhận đơn hoa">
      <header className="receipt-paper-brand">
        <div>
          <Flower2 size={26} aria-hidden="true" />
          <strong>FloraBot</strong>
        </div>
        <p>BIÊN NHẬN ĐƠN HOA</p>
        <time dateTime={receipt.createdAt}>{date(receipt.createdAt)}</time>
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
            <dt>Nhận hoa lúc</dt>
            <dd>
              <time dateTime={receipt.completedAt}>{date(receipt.completedAt)}</time>
            </dd>
          </div>
        )}
      </dl>
      <div className="receipt-paper-lines">
        <h3>Chi tiết tiền hàng</h3>
        <ul className="receipt-items">
          {receipt.items.map((item, index) => (
            <li key={index}>
              <strong>{item.name}</strong>
              <span>
                {item.quantity} × {money(item.unitPrice)}
              </span>
              <span>{money(item.total)}</span>
            </li>
          ))}
        </ul>
      </div>
      <dl className="receipt-totals" aria-label="Tiền hàng và khoản hoàn">
        <div>
          <dt>Tiền hàng</dt>
          <dd>{money(receipt.subtotal)}</dd>
        </div>
        {Number(receipt.discount) > 0 && (
          <div>
            <dt>Giảm giá</dt>
            <dd>{money(receipt.discount)}</dd>
          </div>
        )}
        <div className="receipt-paper-total">
          <dt>Tổng đơn</dt>
          <dd>
            <strong>{money(receipt.total)}</strong>
          </dd>
        </div>
        {(Number(receipt.refunds.pendingAmount) > 0 || refundRelated) && (
          <div>
            <dt>Hoàn tiền đang chờ</dt>
            <dd>{money(receipt.refunds.pendingAmount)}</dd>
          </div>
        )}
        {(Number(receipt.refunds.paidAmount) > 0 || refundRelated) && (
          <div>
            <dt>Đã hoàn</dt>
            <dd>{money(receipt.refunds.paidAmount)}</dd>
          </div>
        )}
      </dl>
      <footer className="receipt-paper-footer">
        <p>Cảm ơn bạn đã chọn FloraBot.</p>
        <span>Tươi mới từng khoảnh khắc.</span>
      </footer>
    </article>
  );
}
