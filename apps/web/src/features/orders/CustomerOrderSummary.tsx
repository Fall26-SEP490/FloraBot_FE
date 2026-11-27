import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Clock, Flower2, Store } from '@florabot/ui';
import { request } from '@/shared/lib/api';
import { safeImage } from '../product-management/product.utils';
import type { CatalogResponse } from '../catalog/catalog.types';
import type { WebOrder } from './orders.types';

import { customerOrderActionLabel, money, statusName, when } from './orders.utils';
import styles from './customer-orders.module.css';

export default function CustomerOrderSummary({ row }: { row: WebOrder }) {
  const [failedPhoto, setFailedPhoto] = useState<string | null>(null);
  const photo = useQuery({
    queryKey: ['customer-order-photo', row.sellerId, row.productId, row.productName],
    queryFn: async () => {
      const params = new URLSearchParams({ page: '1', search: row.productName!.slice(0, 100) });
      const data = await request<CatalogResponse>(`/shop/catalog?${params}`);
      return (
        data.items?.find(
          (item) => item.productId === row.productId && item.sellerId === row.sellerId,
        )?.photo ?? null
      );
    },
    enabled: Boolean(row.productId && row.productName),
    staleTime: 5 * 60_000,
    retry: false,
  });
  const image =
    photo.data && safeImage(photo.data) && photo.data !== failedPhoto ? photo.data : null;
  const hasPrice = row.quotedPrice != null && Number.isFinite(Number(row.quotedPrice));
  const pickupReady = row.ready && row.orderStatus === 'PAID';
  const actionable =
    pickupReady ||
    (row.state === 'QUOTED' && !row.orderId) ||
    row.orderStatus === 'AWAITING_PAYMENT';
  const quotedAccessories = row.quotedAccessories ?? [];
  const requestedAccessories = row.requestedAccessories ?? [];
  const totalLabel =
    row.orderStatus === 'AWAITING_PAYMENT'
      ? 'Cần thanh toán'
      : row.state === 'QUOTED' && !row.orderId
        ? 'Tổng báo giá'
        : 'Thành tiền';
  const statusKey = pickupReady ? 'READY' : row.orderStatus || row.state;
  const footerHint =
    row.state === 'QUOTED' && !row.orderId && row.quoteExpiresAt
      ? `Phản hồi báo giá trước ${when(row.quoteExpiresAt)}`
      : row.orderStatus === 'AWAITING_PAYMENT' && row.payBefore
        ? `Thanh toán trước ${when(row.payBefore)}`
        : '';
  const accessories = quotedAccessories.length ? quotedAccessories : requestedAccessories;

  return (
    <span className={styles.shopeeCard}>
      <span className={styles.shopeeHead}>
        <span className={styles.shopeeShop}>
          <Store size={15} aria-hidden="true" />
          <strong>{row.shopName || 'Shop nhận yêu cầu'}</strong>
        </span>
        <span className={styles.shopeeHeadRight}>
          <span className="order-status-pill" data-status={statusKey}>
            {statusName(row)}
          </span>
        </span>
      </span>

      <span className={styles.shopeeItems}>
        <span className={styles.shopeeItemRow}>
          <span className={styles.thumbnail} aria-hidden="true">
            {image ? (
              <img
                src={image}
                alt=""
                width={80}
                height={80}
                loading="lazy"
                referrerPolicy="no-referrer"
                onError={() => setFailedPhoto(image)}
              />
            ) : (
              <Flower2 size={26} />
            )}
          </span>
          <span className={styles.itemMeta}>
            <strong className={styles.itemTitle}>{row.productName || 'Hoa theo yêu cầu'}</strong>
            <span className={styles.itemSub}>
              <Clock size={12} aria-hidden="true" />
              <span>
                {row.state === 'REQUESTED' ? 'Lịch nhận mong muốn: ' : 'Lịch nhận: '}
                {when(row.pickupAt)}
                {row.kioskName ? ` · ${row.kioskName}` : ''}
              </span>
            </span>
            {accessories.length > 0 && (
              <span className={styles.itemSub}>
                Kèm {accessories.map((item) => `${item.name} ×${item.quantity}`).join(', ')}
              </span>
            )}
          </span>
        </span>
      </span>

      <span className={styles.shopeeFoot}>
        <span className={styles.shopeeTotalRow}>
          {hasPrice ? (
            <>
              <small>{totalLabel}:</small>
              <strong className={styles.shopeeTotalValue}>{money(Number(row.quotedPrice))}</strong>
            </>
          ) : (
            <strong className={styles.pricePending}>Chưa có báo giá</strong>
          )}
        </span>
        <span className={styles.shopeeFootActions}>
          {footerHint && <span className={styles.shopeeFootHint}>{footerHint}</span>}
          <span className={styles.action} data-primary={actionable || undefined}>
            <span className={styles.actionExpand}>{customerOrderActionLabel(row)}</span>
            <span className={styles.actionCollapse}>Thu gọn</span>
          </span>
        </span>
      </span>
    </span>
  );
}
