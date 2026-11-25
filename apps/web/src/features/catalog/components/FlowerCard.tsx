import { useState } from 'react';
import { Button, MapPin, MessageSquare, Star, Store } from '@florabot/ui';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import type { CatalogItem } from '../catalog.types';
import {
  canOrderOnWeb,
  formatPrice,
  isPreorder,
  isPreorderSoldOut,
  isWalkIn,
  purchaseLabel,
} from '../catalog.utils';
import {
  PRODUCT_REVIEWS_STALE_TIME,
  productReviewsQuery,
  readReviewRating,
} from '../product-reviews.api';

const ratingNumber = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 });
const distanceNumber = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 });

interface FlowerCardProps {
  catalogHref?: string;
  hideShopIdentity?: boolean;
  item: CatalogItem;
  distanceKm?: number;
  openingChatId: string | null;
  onSelect: (item: CatalogItem) => void;
  onOpenChat: (item: CatalogItem) => void;
}

export function FlowerCard({
  item,
  distanceKm,
  openingChatId,
  onSelect,
  onOpenChat,
  catalogHref,
  hideShopIdentity = false,
}: FlowerCardProps) {
  const [failedPhoto, setFailedPhoto] = useState<string | null>(null);
  const illustrative = !item.photo || failedPhoto === item.photo;
  const walkIn = isWalkIn(item);
  const preorder = isPreorder(item);
  const reviewable = preorder && !item.isDemoSample;
  const { data: reviews } = useQuery({
    ...productReviewsQuery(item.productId),
    enabled: reviewable,
    staleTime: PRODUCT_REVIEWS_STALE_TIME,
    refetchOnWindowFocus: false,
  });
  const productRating = reviewable
    ? readReviewRating(reviews?.productAverage, reviews?.productCount)
    : null;
  const shopRating = reviewable ? readReviewRating(reviews?.shopAverage, reviews?.shopCount) : null;
  const distance =
    distanceKm === undefined
      ? null
      : distanceKm < 1
        ? `${Math.round(distanceKm * 1000)} m`
        : `${distanceNumber.format(distanceKm)} km`;
  const detailParams = new URLSearchParams();
  if (item.zone) detailParams.set('zone', item.zone);
  if (item.isDemoSample) detailParams.set('demo', '1');
  if (catalogHref && catalogHref !== '/dat-hoa') detailParams.set('from', catalogHref);
  const detailQuery = detailParams.toString();
  const detailHref = `/dat-hoa/${encodeURIComponent(item.productId)}/${encodeURIComponent(item.kioskId)}${detailQuery ? `?${detailQuery}` : ''}`;

  return (
    <li className="flower-card">
      <div className="flower-card-media-wrap">
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
          {(!preorder || isPreorderSoldOut(item)) && (
            <div className="flower-card-badges">
              <span
                className={`flower-badge ${walkIn ? 'flower-badge-stock' : 'flower-badge-custom'}`}
              >
                {purchaseLabel(item)}
              </span>
            </div>
          )}
        </Link>

        <div className="flower-card-actions">
          {canOrderOnWeb(item) && (
            <Button
              className="flower-card-select-btn"
              aria-label="Đặt trước"
              onClick={() => onSelect(item)}
            >
              Đặt trước
            </Button>
          )}
          {walkIn && (
            <Link
              className="button flower-card-select-btn"
              href={`/tim-kiosk?kiosk=${encodeURIComponent(item.kioskId)}`}
            >
              Xem kiosk
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
            <MessageSquare size={16} aria-hidden="true" />
          </Button>
        </div>
      </div>

      <div className="flower-card-body">
        <h2 className="flower-card-title">
          <Link href={detailHref}>{item.name}</Link>
        </h2>

        {productRating && (
          <div className="flower-card-rating">
            <Star size={14} aria-hidden="true" />
            <strong>{ratingNumber.format(productRating.average)}/5</strong>
            <span>({productRating.count.toLocaleString('vi-VN')} đánh giá)</span>
          </div>
        )}
        {reviewable && reviews && Number(reviews.productCount) === 0 && (
          <div className="flower-card-rating">Chưa có đánh giá</div>
        )}

        <div className="flower-card-price-row">
          <div>
            <span className="flower-card-price">{formatPrice(item.price)} đ</span>
            <span className="flower-card-price-label">{walkIn ? 'Giá tại tủ' : 'Giá mẫu'}</span>
          </div>
        </div>

        {(!hideShopIdentity || distance !== null || !preorder) && (
          <div className="flower-card-meta">
            <div className="flower-card-seller-row">
              {!hideShopIdentity && (
                <span className="flower-meta-item" title={item.shopName}>
                  <Store size={14} aria-hidden="true" />
                  <span>{item.shopName}</span>
                </span>
              )}
              {distance !== null && (
                <span
                  className="flower-meta-item flower-card-distance"
                  title="Khoảng cách đường chim bay đến kiosk nhận hoa"
                >
                  <MapPin size={13} aria-hidden="true" />
                  <span className="sr-only">Cách kiosk khoảng </span>
                  <span>{distance}</span>
                </span>
              )}
            </div>
            {!hideShopIdentity && shopRating && (
              <div className="flower-card-shop-rating">
                <Star size={14} aria-hidden="true" />
                <span>Điểm shop</span>
                <strong>{ratingNumber.format(shopRating.average)}/5</strong>
                <span>({shopRating.count.toLocaleString('vi-VN')} đánh giá)</span>
              </div>
            )}
            {!preorder && item.kioskName && (
              <span className="flower-meta-item" title={item.kioskName}>
                <MapPin size={14} aria-hidden="true" />
                <span>{item.kioskName}</span>
              </span>
            )}
            {walkIn && item.address && <span className="flower-meta-item">{item.address}</span>}
          </div>
        )}
      </div>
    </li>
  );
}
