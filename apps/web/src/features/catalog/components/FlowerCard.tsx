import { Button, MapPin, MessageSquare, Store } from '@florabot/ui';
import type { CatalogItem } from '../catalog.types';
import { formatPrice, getOccasionBadgeClass } from '../catalog.utils';

interface FlowerCardProps {
  item: CatalogItem;
  openingChatId: string | null;
  onSelect: (item: CatalogItem) => void;
  onOpenDetail: (item: CatalogItem, triggerEl: HTMLElement) => void;
  onOpenChat: (item: CatalogItem) => void;
}

export function FlowerCard({
  item,
  openingChatId,
  onSelect,
  onOpenDetail,
  onOpenChat,
}: FlowerCardProps) {
  const hasStock = Boolean(item.bouquets && item.bouquets.length > 0);
  const occBadgeClass = getOccasionBadgeClass(item.occasion);

  return (
    <li className="flower-card">
      <div className="flower-card-media">
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
          <span
            className={`flower-badge ${hasStock ? 'flower-badge-stock' : 'flower-badge-custom'}`}
          >
            {hasStock ? `Có sẵn ${item.bouquets.length} bó` : 'Đặt trước'}
          </span>
          {item.occasion && (
            <span className={`flower-badge flower-badge-occasion ${occBadgeClass}`}>
              {item.occasion}
            </span>
          )}
        </div>
      </div>

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
        </div>

        <div className="flower-card-price-row">
          <div>
            <span className="flower-card-price">{formatPrice(item.price)} đ</span>
            <span className="flower-card-price-label"> · giá mẫu</span>
          </div>
        </div>

        <div className="flower-card-actions">
          <Button
            className="flower-card-select-btn"
            aria-label="Chọn mẫu và cách nhận"
            onClick={() => onSelect(item)}
          >
            Chọn mẫu
          </Button>
          <div className="flower-card-secondary-btns">
            <Button
              variant="outline"
              className="flower-card-detail-btn"
              aria-label="Xem chi tiết"
              onClick={(e) => onOpenDetail(item, e.currentTarget)}
            >
              Chi tiết
            </Button>
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
      </div>
    </li>
  );
}
