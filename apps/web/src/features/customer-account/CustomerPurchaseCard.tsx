import Link from 'next/link';
import type { CustomerHistoryItem } from './customer-account.types';
import { ORDER_STATUS_LABELS } from './customer-account.types';
import { money, when } from '../orders/orders.utils';
import styles from '../orders/customer-orders.module.css';

export function CustomerPurchaseCard({
  order,
  disclosureGroup,
}: {
  order: CustomerHistoryItem;
  disclosureGroup: string;
}) {
  return (
    <li>
      <details className={styles.purchase} name={disclosureGroup}>
        <summary className={styles.summary}>
          <span className={styles.content}>
            <span className={styles.heading}>
              <strong>{order.items.join(', ') || 'Đơn mua hoa'}</strong>
              <span className="order-status-pill" data-status={order.status}>
                {ORDER_STATUS_LABELS[order.status] || order.status}
              </span>
            </span>
            <span className={styles.shop}>
              {order.shopName} · {order.orderCode}
            </span>
            <span className={styles.purchaseMeta}>
              <span>Ngày mua: {when(order.createdAt)}</span>
              <strong>{money(Number(order.totalAmount))}</strong>
            </span>
            <span className={styles.action}>Xem giao dịch →</span>
          </span>
        </summary>
        <div className={styles.purchaseDetails}>
          <dl className={styles.quoteFacts}>
            <div>
              <dt>Điểm được cộng</dt>
              <dd>{Number(order.pointsEarned).toLocaleString('vi-VN')}</dd>
            </div>
            <div>
              <dt>Điểm đã dùng</dt>
              <dd>{Number(order.pointsRedeemed).toLocaleString('vi-VN')}</dd>
            </div>
          </dl>
          <Link href="/lien-he">Liên hệ hỗ trợ về giao dịch {order.orderCode}</Link>
        </div>
      </details>
    </li>
  );
}
