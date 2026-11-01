import { useState } from 'react';
import { Button, MapPin, MessageSquare, Store } from '@florabot/ui';
import Link from 'next/link';
import type { CatalogItem } from '../catalog.types';
import {
  canOrderOnWeb,
  formatPrice,
  getOccasionBadgeClass,
  isWalkIn,
  purchaseLabel,
} from '../catalog.utils';

interface FlowerCardProps {
  catalogHref?: string;
  item: CatalogItem;
  openingChatId: string | null;
  onSelect: (item: CatalogItem) => void;
  onOpenChat: (item: CatalogItem) => void;
}

export function FlowerCard({
  item,
  openingChatId,
  onSelect,
  onOpenChat,
  catalogHref,
}: FlowerCardProps) {
  const [failedPhoto, setFailedPhoto] = useState<string | null>(null);
  const illustrative = !item.photo || failedPhoto === item.photo;
  const walkIn = isWalkIn(item);
  const occBadgeClass = getOccasionBadgeClass(item.occasion);
  const detailParams = new URLSearchParams();
  if (item.zone) detailParams.set('zone', item.zone);
  if (item.isDemoSample) detailParams.set('demo', '1');
  if (catalogHref && catalogHref !== '/dat-hoa') detailParams.set('from', catalogHref);
  const detailQuery = detailParams.toString();
  const detailHref = `/dat-hoa/${encodeURIComponent(item.productId)}/${encodeURIComponent(item.kioskId)}${detailQuery ? `?${detailQuery}` : ''}`;

  return (
    <li className="flower-card">
      <Link
        className="flower-card-media"
        href={detailHref}
        aria-label={`Xem chi tiết ${item.name}`}
      >
        <img
          src={illustrative ? '/images/floral-white-online.webp' : item.photo!}
          alt={
            illustrative
              ? 'Ảnh hoa minh họa, chưa có ảnh sản phẩm'
              : `Mẫu ${item.name} từ ${item.shopName}`
          }
          loading="lazy"
          className="flower-card-img"
          onError={() => {
            if (item.photo) setFailedPhoto(item.photo);
          }}
        />
        {illustrative && <span className="flower-card-illustration">Ảnh minh họa</span>}
        <div className="flower-card-badges">
          <span className={`flower-badge ${walkIn ? 'flower-badge-stock' : 'flower-badge-custom'}`}>
            {purchaseLabel(item)}
          </span>
          {item.occasion && (
            <span className={`flower-badge flower-badge-occasion ${occBadgeClass}`}>
              {item.occasion}
            </span>
          )}
        </div>
      </Link>

      <div className="flower-card-body">
        <h2 className="flower-card-title">
          <Link href={detailHref}>{item.name}</Link>
        </h2>
        <p className="flower-card-desc">
          {item.description || 'Mẫu hoa do shop thiết kế theo yêu cầu của bạn.'}
        </p>

        <div className="flower-card-meta">
          <span className="flower-meta-item" title={item.shopName}>
            <Store size={14} aria-hidden="true" />
            <span>{item.shopName}</span>
          </span>
          <span className="flower-meta-item" title={item.kioskName}>
            <MapPin size={14} aria-hidden="true" />
            <span>{item.kioskName}</span>
          </span>
          {walkIn && item.address && <span className="flower-meta-item">{item.address}</span>}
        </div>

        <div className="flower-card-price-row">
          <div>
            <span className="flower-card-price">{formatPrice(item.price)} đ</span>
            <span className="flower-card-price-label">
              {walkIn ? ' · giá niêm yết' : ' · giá tham khảo'}
            </span>
          </div>
        </div>

        <div className="flower-card-actions">
          {canOrderOnWeb(item) && (
            <Button
              className="flower-card-select-btn"
              aria-label="Yêu cầu báo giá"
              onClick={() => onSelect(item)}
            >
              Yêu cầu báo giá
            </Button>
          )}
          {walkIn && (
            <Link
              className="button flower-card-select-btn"
              href={`/tim-kiosk?kiosk=${encodeURIComponent(item.kioskId)}`}
            >
              Xem tủ để mua
            </Link>
          )}
          <Button
            variant="outline"
            type="button"
            className="chat-open-btn flower-card-chat-btn"
            disabled={openingChatId === item.productId}
            title={`Nhắn tin với ${item.shopName}`}
            aria-label="Nhắn tin với shop"
            onClick={() => void onOpenChat(item)}
          >
            <MessageSquare size={14} aria-hidden="true" />
            <span>{openingChatId === item.productId ? 'Đang mở…' : 'Chat'}</span>
          </Button>
        </div>
      </div>
    </li>
  );
}
