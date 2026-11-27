import type { Ref } from 'react';
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
  const pendingRefund = Number(receipt.refunds.pendingAmount);
  const paidRefund = Number(receipt.refunds.paidAmount);
  return (
    <article className="receipt-paper" aria-label="Biên nhận đơn hoa">
      <header className="receipt-paper-brand">
        <span className="receipt-paper-emblem" aria-hidden="true">
          <img src="/favicon-rose.png" alt="" width={38} height={38} />
        </span>
        <strong>FloraBot</strong>
        <p>BIÊN NHẬN ĐƠN HOA</p>
      </header>
      <div className="receipt-paper-meta">
        <div>
          <span className="receipt-meta-label">Mã đơn hàng</span>
          <h2 id="receipt-result" ref={headingRef} tabIndex={-1}>
            Đơn {receipt.orderCode}
          </h2>
        </div>
        <div>
          <span className="receipt-meta-label">Ngày tạo đơn</span>
          <p className="receipt-meta-value">
            <time dateTime={receipt.createdAt}>{date(receipt.createdAt)}</time>
          </p>
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
      <div className="receipt-paper-lines">
        <h3 className="sr-only">Chi tiết tiền hàng</h3>
        <div className="receipt-items-head" aria-hidden="true">
          <span>STT</span>
          <span>Sản phẩm</span>
          <span>SL</span>
          <span>Đơn giá</span>
          <span>Thành tiền</span>
        </div>
        <ul className="receipt-items">
          {receipt.items.map((item, index) => (
            <li key={index}>
              <span className="receipt-item-no">{index + 1}</span>
              <strong className="receipt-item-name">{item.name}</strong>
              <span className="receipt-item-qty">{item.quantity}</span>
              <span className="receipt-item-price">{money(item.unitPrice)}</span>
              <span className="receipt-item-total">{money(item.total)}</span>
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
            <dd>-{money(receipt.discount)}</dd>
          </div>
        )}
        <div className="receipt-paper-total">
          <dt>Tổng đơn</dt>
          <dd>
            <strong>{money(receipt.total)}</strong>
          </dd>
        </div>
        {pendingRefund > 0 && (
          <div>
            <dt>Hoàn tiền đang chờ</dt>
            <dd>{money(receipt.refunds.pendingAmount)}</dd>
          </div>
        )}
        {(paidRefund > 0 || receipt.status === 'REFUNDED') && (
          <div>
            <dt>Đã hoàn</dt>
            <dd>{money(receipt.refunds.paidAmount)}</dd>
          </div>
        )}
      </dl>
      <footer className="receipt-paper-footer">
        <p>Cảm ơn bạn đã chọn FloraBot.</p>
      </footer>
    </article>
  );
}
