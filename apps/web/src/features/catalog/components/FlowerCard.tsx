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
  item: CatalogItem;
  openingChatId: string | null;
  onSelect: (item: CatalogItem) => void;
  onOpenChat: (item: CatalogItem) => void;
}

export function FlowerCard({ item, openingChatId, onSelect, onOpenChat }: FlowerCardProps) {
  const walkIn = isWalkIn(item);
  const occBadgeClass = getOccasionBadgeClass(item.occasion);
  const detailParams = new URLSearchParams();
  if (item.zone) detailParams.set('zone', item.zone);
  if (item.isDemoSample) detailParams.set('demo', '1');
  const detailQuery = detailParams.toString();

  return (
    <li className="flower-card">
      <Link
        className="flower-card-media"
        href={`/dat-hoa/${encodeURIComponent(item.productId)}/${encodeURIComponent(item.kioskId)}${detailQuery ? `?${detailQuery}` : ''}`}
        aria-label={`Xem chi tiết ${item.name}`}
      >
        <img
          src={item.photo || '/images/floral-white-online.webp'}
          alt={`Mẫu ${item.name} từ ${item.shopName}`}
          loading="lazy"
          className="flower-card-img"
          onError={(e) => {
            const target = e.currentTarget;
            if (!target.dataset.fallback) {
              target.dataset.fallback = '1';
              target.src = '/images/floral-white-online.webp';
            }
          }}
        />
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
        <h2 className="flower-card-title">{item.name}</h2>
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
            <span className="flower-card-price-label"> · giá mẫu</span>
          </div>
        </div>

        <div className="flower-card-actions">
          {canOrderOnWeb(item) && (
            <Button
              className="flower-card-select-btn"
              aria-label="Đặt hoa"
              onClick={() => onSelect(item)}
            >
              Đặt hoa
            </Button>
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
