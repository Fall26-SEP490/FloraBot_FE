import type { RefObject } from 'react';
import { Button, MessageSquare, X } from '@florabot/ui';
import type { CatalogItem } from '../catalog.types';
import { formatPrice } from '../catalog.utils';
import { FlowerRequestForm } from './FlowerRequestForm';

interface FlowerDetailsDialogProps {
  item: CatalogItem | null;
  onClose: () => void;
  onOpenChat: (item: CatalogItem) => void;
  openingChatId: string | null;
  modalContentRef: RefObject<HTMLDivElement | null>;
  modalCloseBtnRef: RefObject<HTMLButtonElement | null>;
}

export function FlowerDetailsDialog({
  item,
  onClose,
  onOpenChat,
  openingChatId,
  modalContentRef,
  modalCloseBtnRef,
}: FlowerDetailsDialogProps) {
  if (!item) return null;

  return (
    <div className="product-modal-backdrop">
      <button
        type="button"
        className="product-modal-scrim"
        aria-label="Đóng chi tiết sản phẩm"
        onClick={onClose}
      />
      <div
        ref={modalContentRef}
        className="product-modal-content"
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-modal-title"
      >
        <button
          ref={modalCloseBtnRef}
          type="button"
          className="product-modal-close-btn"
          aria-label="Đóng chi tiết sản phẩm"
          onClick={onClose}
        >
          <X size={20} aria-hidden="true" />
        </button>

        <div className="product-modal-media">
          <img
            src={item.photo || '/images/floral-white-online.webp'}
            alt={item.name}
            className="product-modal-img"
            onError={(e) => {
              const target = e.currentTarget;
              if (!target.dataset.fallback) {
                target.dataset.fallback = '1';
                target.src = '/images/floral-white-online.webp';
              }
            }}
          />
        </div>

        <div className="product-modal-body">
          <div>
            <h2 id="product-modal-title" className="product-modal-title">
              {item.name}
            </h2>
            <p style={{ color: '#385540', fontSize: '0.9rem', marginTop: '0.25rem' }}>
              Shop: <strong>{item.shopName}</strong> · Tủ nhận: <strong>{item.kioskName}</strong> (
              {item.address})
            </p>
          </div>

          <div className="product-modal-price">
            {formatPrice(item.price)} đ{' '}
            <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#34523e' }}>
              · giá mẫu tham khảo
            </span>
          </div>

          <p style={{ color: '#385540', lineHeight: 1.6, fontSize: '0.95rem' }}>
            {item.description ||
              'Mẫu hoa do shop thiết kế. Hãy trao đổi với shop về màu sắc, kích thước và phụ kiện trước khi xác nhận báo giá.'}
          </p>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span
              className={`flower-badge ${item.bouquets.length ? 'flower-badge-stock' : 'flower-badge-custom'}`}
            >
              {item.bouquets.length
                ? `Có sẵn ${item.bouquets.length} bó tại tủ`
                : 'Đặt trước (Pre-order) theo yêu cầu'}
            </span>
            {item.occasion && (
              <span className="flower-badge flower-badge-occasion">Dịp: {item.occasion}</span>
            )}
          </div>

          <div className="product-modal-form-wrap">
            <h3 style={{ fontSize: '1.05rem', color: '#113421', marginBottom: '0.75rem' }}>
              Đặt bó hoa này
            </h3>
            <FlowerRequestForm key={`modal-${item.productId}-${item.kioskId}`} item={item} />
          </div>

          <div style={{ marginTop: '0.5rem' }}>
            <Button
              variant="outline"
              type="button"
              className="chat-open-btn"
              style={{ width: '100%', minHeight: '44px' }}
              disabled={openingChatId === item.productId}
              onClick={() => onOpenChat(item)}
            >
              <MessageSquare size={16} aria-hidden="true" />
              {openingChatId === item.productId ? 'Đang mở chat…' : 'Nhắn tin với shop'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
