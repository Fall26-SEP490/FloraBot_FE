import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, ChevronDown, MapPin, Clock, Flower2 } from '@florabot/ui';
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
  const hasPrice = row.quotedPrice != null && Number.isFinite(row.quotedPrice);
  const pickupReady = row.ready && row.orderStatus === 'PAID';
  const label =
    row.orderStatus === 'AWAITING_PAYMENT'
      ? 'Cần thanh toán'
      : row.state === 'QUOTED' && !row.orderId
        ? 'Shop báo giá'
        : 'Tổng tiền';
  return (
    <span className={styles.summaryLayout}>
      <span className={styles.thumbnail} aria-hidden="true">
        {image ? (
          <img
            src={image}
            alt=""
            width={68}
            height={80}
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setFailedPhoto(image)}
          />
        ) : (
          <Flower2 size={22} />
        )}
      </span>
      <span className={styles.content}>
        <span className={styles.heading}>
          <strong>{row.productName || 'Hoa theo yêu cầu'}</strong>
        </span>
        <span className={styles.shop}>
          {row.shopName || 'Shop nhận yêu cầu'} · {row.orderCode || `Yêu cầu ${row.id.slice(0, 8)}`}
        </span>
      </span>
      <span className={styles.facts}>
        <span className={styles.fact}>
          <span className={styles.factLabel}>
            <MapPin size={14} aria-hidden="true" /> Tủ nhận hoa
          </span>
          <span className={styles.factValue}>{row.kioskName || 'Xem địa điểm trong chi tiết'}</span>
        </span>
        <span className={styles.fact}>
          <span className={styles.factLabel}>
            <Clock size={14} aria-hidden="true" />
            {row.state === 'REQUESTED' ? 'Lịch nhận mong muốn' : 'Lịch nhận'}
          </span>
          <span className={styles.factValue}>{when(row.pickupAt)}</span>
        </span>
      </span>
      <span className={styles.summaryAside}>
        <span
          className="order-status-pill"
          data-status={pickupReady ? 'READY' : row.orderStatus || row.state}
        >
          {statusName(row)}
        </span>
        <span className={styles.summaryPrice}>
          <small>{hasPrice ? label : 'Báo giá'}</small>
          <strong>{hasPrice ? money(row.quotedPrice!) : 'Chưa có báo giá'}</strong>
        </span>
        <span className={styles.action}>
          <span className={styles.actionExpand}>
            {customerOrderActionLabel(row)}
            <ArrowRight size={16} aria-hidden="true" />
          </span>
          <span className={styles.actionCollapse}>
            Thu gọn
            <ChevronDown size={16} aria-hidden="true" />
          </span>
        </span>
      </span>
    </span>
  );
}
