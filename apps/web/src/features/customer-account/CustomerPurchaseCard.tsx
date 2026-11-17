import type { ComponentProps } from 'react';
import { ArrowRight, Button, ChevronDown, Clock, Package } from '@florabot/ui';
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
    <li>
      <details {...disclosureProps} className={styles.purchase} name={disclosureGroup}>
        <summary className={styles.summary}>
          <span className={styles.summaryLayout}>
            <span className={styles.thumbnail} aria-hidden="true">
              <Package size={20} />
            </span>
            <span className={styles.content}>
              <span className={styles.heading}>
                <strong>{order.items.join(', ') || 'Đơn mua hoa'}</strong>
              </span>
              <span className={styles.shop}>
                {order.shopName} · {order.orderCode}
              </span>
            </span>
            <span className={styles.facts}>
              <span className={styles.fact}>
                <span className={styles.factLabel}>Hình thức mua</span>
                <span className={styles.factValue}>Mua tại kiosk</span>
              </span>
              <span className={styles.fact}>
                <span className={styles.factLabel}>
                  <Clock size={14} aria-hidden="true" /> Ngày mua
                </span>
                <span className={styles.factValue}>{when(order.createdAt)}</span>
              </span>
            </span>
            <span className={styles.summaryAside}>
              <span className="order-status-pill" data-status={order.status}>
                {ORDER_STATUS_LABELS[order.status] || order.status}
              </span>
              <span className={styles.summaryPrice}>
                <small>Tổng tiền</small>
                <strong>{money(Number(order.totalAmount))}</strong>
              </span>
              <span className={styles.action}>
                <span className={styles.actionExpand}>
                  Xem giao dịch
                  <ArrowRight size={16} aria-hidden="true" />
                </span>
                <span className={styles.actionCollapse}>
                  Thu gọn
                  <ChevronDown size={16} aria-hidden="true" />
                </span>
              </span>
            </span>
          </span>
        </summary>
        <div className={styles.orderDetails}>
          <div className={styles.quoteReview}>
            <div className={styles.quotePickupBlock}>
              <h3 className={styles.detailHeading}>Thông tin giao dịch tại kiosk</h3>
              <dl className={styles.quoteFacts}>
                <div>
                  <dt>Ngày mua</dt>
                  <dd>{when(order.createdAt)}</dd>
                </div>
                <div>
                  <dt>Điểm được cộng</dt>
                  <dd>{Number(order.pointsEarned).toLocaleString('vi-VN')}</dd>
                </div>
                <div>
                  <dt>Điểm đã dùng</dt>
                  <dd>{Number(order.pointsRedeemed).toLocaleString('vi-VN')}</dd>
                </div>
              </dl>
            </div>
            <div className={styles.quoteAmountBlock}>
              <div className={styles.quotePrice}>
                <span>Tổng thanh toán</span>
                <strong>{money(Number(order.totalAmount))}</strong>
              </div>
              <div className={styles.interaction}>
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
