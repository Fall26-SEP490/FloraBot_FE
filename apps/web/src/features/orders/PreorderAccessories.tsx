import type { QuotedPreorderAccessory, WebOrder } from './orders.types';
import { money } from './orders.utils';
import styles from './preorder-accessories.module.css';

export function PreorderAccessories({
  row,
  showTotal = false,
  totalLabel = 'Tổng báo giá đã gửi',
  compact = false,
}: {
  row: WebOrder;
  showTotal?: boolean;
  totalLabel?: string;
  compact?: boolean;
}) {
  const requested = row.requestedAccessories ?? [];
  const quoted = row.quotedAccessories ?? [];
  const hasBreakdown = row.quotedPrice != null && row.quotedFlowerPrice != null;
  const hasTotal = showTotal && row.quotedPrice != null;
  if (!requested.length && !quoted.length && !hasTotal) return null;

  const reductions = hasBreakdown
    ? requested.flatMap(({ accessoryId, name, quantity }) => {
        const accepted = Number(
          quoted.find((item) => item.accessoryId === accessoryId)?.quantity ?? 0,
        );
        return accepted < Number(quantity) ? [{ accessoryId, name, quantity, accepted }] : [];
      })
    : [];

  return (
    <section
      className={styles.section}
      aria-label={hasBreakdown || hasTotal ? 'Chi tiết báo giá' : 'Phụ kiện khách yêu cầu'}
    >
      <strong>{hasBreakdown || hasTotal ? 'Chi tiết báo giá' : 'Phụ kiện khách yêu cầu'}</strong>
      {hasBreakdown ? (
        <>
          <dl className={styles.lines}>
            <div>
              <dt>Bó hoa</dt>
              <dd>{money(Number(row.quotedFlowerPrice))}</dd>
            </div>
            {quoted.map(({ accessoryId, name, quantity, unitPrice, lineTotal }) => (
              <div key={accessoryId}>
                <dt>
                  {name}{' '}
                  {(!compact || Number(quantity) !== 1) && (
                    <small>
                      {quantity} × {money(Number(unitPrice))}
                    </small>
                  )}
                </dt>
                <dd>{money(Number(lineTotal))}</dd>
              </div>
            ))}
            {!compact && (requested.length > 0 || quoted.length > 0) && (
              <div className={styles.subtotal}>
                <dt>Tổng phụ kiện</dt>
                <dd>{money(Number(row.quotedAccessoryTotal ?? 0))}</dd>
              </div>
            )}
          </dl>
          {reductions.length > 0 && (
            <div
              className={styles.adjustments}
              data-history={compact && Boolean(row.orderId) ? true : undefined}
            >
              <strong>
                {compact && row.orderId
                  ? 'Điều chỉnh phụ kiện trong báo giá'
                  : 'Thay đổi so với yêu cầu'}
              </strong>
              <ul>
                {reductions.map(({ accessoryId, name, quantity, accepted }) => (
                  <li key={accessoryId}>
                    {name}: {accepted ? `shop nhận ${accepted}/${quantity}` : 'shop không nhận'}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      ) : requested.length > 0 ? (
        <ul>
          {requested.map(({ accessoryId, name, quantity }) => (
            <li key={accessoryId}>
              {name} × {quantity}
            </li>
          ))}
        </ul>
      ) : null}
      {hasTotal && (
        <dl className={`${styles.lines} ${styles.subtotal}`}>
          <div>
            <dt>
              <strong>{totalLabel}</strong>
            </dt>
            <dd>
              <strong>{money(Number(row.quotedPrice))}</strong>
            </dd>
          </div>
        </dl>
      )}
    </section>
  );
}

export function PreorderPackingList({ items }: { items?: QuotedPreorderAccessory[] }) {
  if (!items?.length) return null;
  return (
    <section className={styles.section} aria-label="Phụ kiện cần đóng gói">
      <strong>Phụ kiện cần đóng gói</strong>
      <ul>
        {items.map(({ accessoryId, name, quantity }) => (
          <li key={accessoryId}>
            {name} × {quantity}
          </li>
        ))}
      </ul>
      <p>Đặt tất cả phụ kiện vào cùng ô với bó hoa.</p>
    </section>
  );
}
