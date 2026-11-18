import { useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Flower2, MapPin, Store } from '@florabot/ui';
import type { FlowerChatSuggestion } from './flower-advisor.types';

const currency = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' });
const number = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 });

export function FlowerAdvisorSuggestion({ item }: { item: FlowerChatSuggestion }) {
  const [brokenPhoto, setBrokenPhoto] = useState(false);
  const preorder = item.mode === 'PREORDER';
  const action = preorder ? 'Xem mẫu đặt trước' : 'Mua tại tủ';
  const hasRatings = preorder && (item.productRating != null || item.shopRating != null);
  return (
    <article className="flower-advisor-suggestion">
      <div className="flower-advisor-product">
        <div className="flower-advisor-product-summary">
          {item.photo && !brokenPhoto ? (
            <img
              className="flower-advisor-photo"
              src={item.photo}
              alt={item.name}
              loading="lazy"
              onError={() => setBrokenPhoto(true)}
            />
          ) : (
            <div
              className="flower-advisor-photo flower-advisor-photo--empty"
              role="img"
              aria-label="Mẫu hoa chưa có ảnh"
            >
              <Flower2 size={24} aria-hidden="true" />
              <span>Chưa có ảnh</span>
            </div>
          )}
          <div className="flower-advisor-product-main">
            <span className="flower-advisor-product-mode">
              {preorder ? 'Đặt trước' : 'Mua tại tủ'}
            </span>
            <h3 title={item.name}>{item.name}</h3>
            <div className="flower-advisor-price-row">
              <strong className="flower-advisor-price">{currency.format(item.price)}</strong>
              {preorder && <span>Giá mẫu</span>}
            </div>
          </div>
        </div>
        {item.reason && <p className="flower-advisor-product-reason">{item.reason}</p>}
        {(item.shopName || item.kioskName) && (
          <div className="flower-advisor-product-location">
            {item.shopName && (
              <span>
                <Store size={14} aria-hidden="true" />
                {item.shopName}
              </span>
            )}
            {item.kioskName && (
              <span>
                <MapPin size={14} aria-hidden="true" />
                {item.kioskName}
              </span>
            )}
          </div>
        )}
        {item.distanceKm != null && (
          <span className="flower-advisor-muted">
            Cách khoảng {number.format(item.distanceKm)} km · đường chim bay
          </span>
        )}
        {hasRatings && (
          <div className="flower-advisor-ratings">
            {item.productRating != null && (
              <span>
                Mẫu hoa: {number.format(item.productRating)}/5 ({item.productReviews} lượt)
              </span>
            )}
            {item.shopRating != null && (
              <span>
                Shop: {number.format(item.shopRating)}/5 ({item.shopReviews} lượt)
              </span>
            )}
          </div>
        )}
        <Link
          className="flower-advisor-product-link"
          aria-label={action + ': ' + item.name}
          href={
            preorder
              ? '/dat-hoa/' +
                encodeURIComponent(item.productId) +
                '/' +
                encodeURIComponent(item.kioskId) +
                '?zone=PREORDER'
              : '/tim-kiosk?kiosk=' + encodeURIComponent(item.kioskId)
          }
        >
          {action}
          <ChevronRight size={16} aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}
