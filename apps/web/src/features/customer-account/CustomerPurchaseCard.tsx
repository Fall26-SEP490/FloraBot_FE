import type { ComponentProps } from 'react';
import { Button, Clock, Package, Store } from '@florabot/ui';
import type { CustomerHistoryItem } from './customer-account.types';
import { ORDER_STATUS_LABELS } from './customer-account.types';
import { money, when } from '../orders/orders.utils';
import styles from '../orders/customer-orders.module.css';

export function CustomerPurchaseCard({
  order,
  disclosureGroup,
  supportHref = '/lien-he',
  ...disclosureProps
}: {
  order: CustomerHistoryItem;
  disclosureGroup: string;
  supportHref?: string;
} & Pick<ComponentProps<'details'>, 'id' | 'open' | 'onToggle' | 'onClickCapture'>) {
  return (
    <li data-order-tone="closed">
      <details {...disclosureProps} className={styles.purchase} name={disclosureGroup}>
        <summary className={styles.summary}>
          <span className={styles.shopeeCard}>
            <span className={styles.shopeeHead}>
              <span className={styles.shopeeShop}>
                <Store size={15} aria-hidden="true" />
                <strong>{order.shopName}</strong>
                <span className={styles.shopeeKindTag}>Tại kiosk</span>
              </span>
              <span className={styles.shopeeHeadRight}>
                <span className="order-status-pill" data-status={order.status}>
                  {ORDER_STATUS_LABELS[order.status] || order.status}
                </span>
              </span>
            </span>

            <span className={styles.shopeeItems}>
              <span className={styles.shopeeItemRow}>
                <span className={styles.thumbnail} aria-hidden="true">
                  <Package size={24} />
                </span>
                <span className={styles.itemMeta}>
                  <strong className={styles.itemTitle}>
                    {order.items.join(', ') || 'Đơn mua hoa'}
                  </strong>
                  <span className={styles.itemSub}>
                    <Clock size={12} aria-hidden="true" />
                    <span>Giao dịch mua trực tiếp tại tủ kiosk · {when(order.createdAt)}</span>
                  </span>
                </span>
              </span>
            </span>

            <span className={styles.shopeeFoot}>
              <span className={styles.shopeeTotalRow}>
                <small>Thành tiền:</small>
                <strong className={styles.shopeeTotalValue}>
                  {money(Number(order.totalAmount))}
                </strong>
              </span>
              <span className={styles.shopeeFootActions}>
                <span className={styles.action}>
                  <span className={styles.actionExpand}>Xem chi tiết</span>
                  <span className={styles.actionCollapse}>Thu gọn</span>
                </span>
              </span>
            </span>
          </span>
        </summary>
        <div className={styles.orderDetails}>
          <div className={styles.shopeeDetailSheet}>
            <dl className={styles.shopeeLedger}>
              <div className={styles.shopeeLedgerRow}>
                <dt>Hình thức mua</dt>
                <dd>Mua trực tiếp tại kiosk</dd>
              </div>
              <div className={styles.shopeeLedgerRow}>
                <dt>Ngày mua</dt>
                <dd>{when(order.createdAt)}</dd>
              </div>
              <div className={styles.shopeeLedgerRow}>
                <dt>Điểm được cộng</dt>
                <dd>{Number(order.pointsEarned).toLocaleString('vi-VN')} điểm</dd>
              </div>
              <div className={styles.shopeeLedgerRow}>
                <dt>Điểm đã dùng</dt>
                <dd>{Number(order.pointsRedeemed).toLocaleString('vi-VN')} điểm</dd>
              </div>
              <div className={`${styles.shopeeLedgerRow} ${styles.shopeeLedgerTotal}`}>
                <dt>Tổng thanh toán</dt>
                <dd>{money(Number(order.totalAmount))}</dd>
              </div>
              <div className={styles.shopeeLedgerRow}>
                <dt>Mã đơn hàng</dt>
                <dd className={styles.shopeeLedgerCode}>{order.orderCode}</dd>
              </div>
            </dl>
            <div className={styles.interaction}>
              <div className={`stock-actions ${styles.memberActionRow}`}>
                <Button asChild variant="outline">
                  <a href={supportHref} referrerPolicy="no-referrer">
                    Liên hệ hỗ trợ về giao dịch {order.orderCode}
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </details>
    </li>
  );
}
