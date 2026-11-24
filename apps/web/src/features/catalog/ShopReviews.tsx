'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Button, Store } from '@florabot/ui';
import { ApiError, request } from '@/shared/lib/api';
import { FlowerGridSkeleton } from '@/shared/components/PageSkeleton';
import type { components } from '../../../../../packages/contracts/src/generated/api';
import { RatingStars } from './components/RatingStars';
import { readReviewRating } from './product-reviews.api';
import './styles/catalog.css';
import './styles/shop-reviews.css';

const date = new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'medium',
  timeZone: 'Asia/Ho_Chi_Minh',
});
const number = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 });

export default function ShopReviews({
  sellerId,
  shopPath,
  shopHref,
  page,
}: {
  sellerId: string;
  shopPath: string;
  shopHref: string;
  page: number;
}) {
  const reviews = useQuery({
    queryKey: ['shop-flower-reviews', sellerId, page],
    queryFn: () =>
      request<components['schemas']['ShopFlowerReviewPage']>(
        `/shop/sellers/${sellerId}/reviews?page=${page}`,
      ),
  });
  const data = reviews.data;
  const rating = readReviewRating(data?.shopAverage, data?.shopCount);
  const notFound = reviews.error instanceof ApiError && reviews.error.status === 404;
  const pageHref = (number: number) => {
    const query = new URLSearchParams();
    if (number > 1) query.set('page', String(number));
    if (shopHref !== shopPath) query.set('from', shopHref);
    return shopPath + '/danh-gia' + (query.size ? '?' + query.toString() : '');
  };

  return (
    <main id="main" className="flower-shop-page shop-reviews-page">
      <nav className="catalog-store-breadcrumb" aria-label="Đường dẫn đánh giá">
        <Link href={shopHref} className="flower-detail-back">
          <ArrowLeft size={16} aria-hidden="true" />
          Quay lại cửa hàng
        </Link>
      </nav>
      <header className="shop-reviews-header">
        <div className="catalog-store-identity">
          <span className="catalog-store-icon" aria-hidden="true">
            <Store size={26} />
          </span>
          <div>
            <h1>Đánh giá cửa hàng</h1>
            {data && <p>{data.shopName}</p>}
          </div>
        </div>
        {rating && (
          <div className="shop-reviews-summary">
            <strong aria-hidden="true">{number.format(rating.average)}/5</strong>
            <div>
              <RatingStars value={rating.average} />
              <span>{number.format(rating.count)} lượt đánh giá</span>
            </div>
          </div>
        )}
      </header>

      {reviews.isPending && (
        <FlowerGridSkeleton gridClassName="shop-review-grid" count={3} label="Đang tải đánh giá" />
      )}
      {reviews.isError && !data && (
        <div className="flower-detail-feedback" role="alert">
          <p>
            {notFound ? 'Trang đánh giá của cửa hàng chưa khả dụng.' : 'Chưa tải được đánh giá.'}
          </p>
          {!notFound && <Button onClick={() => void reviews.refetch()}>Tải lại đánh giá</Button>}
        </div>
      )}
      {data && (
        <>
          {data.items.length > 0 ? (
            <ul className="shop-review-grid" aria-label="Đánh giá của khách hàng">
              {data.items.map((review) => (
                <li key={review.id}>
                  <article className="shop-review-card">
                    <header className="shop-review-author">
                      <span aria-hidden="true" className="shop-review-avatar">
                        {review.reviewerName
                          .trim()
                          .split(/\s+/)
                          .at(-1)
                          ?.slice(0, 1)
                          .toLocaleUpperCase('vi-VN')}
                      </span>
                      <div>
                        <h2>{review.reviewerName}</h2>
                        <time dateTime={review.createdAt}>
                          {date.format(new Date(review.createdAt))}
                        </time>
                      </div>
                    </header>
                    <RatingStars value={Number(review.stars)} />
                    <p className="shop-review-product">{review.productName}</p>
                    {review.comment && <p className="shop-review-comment">{review.comment}</p>}
                    {review.photoUrl && (
                      <a
                        className="shop-review-photo"
                        href={review.photoUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <img src={review.photoUrl} alt="Ảnh hoa khách nhận" loading="lazy" />
                      </a>
                    )}
                  </article>
                </li>
              ))}
            </ul>
          ) : (
            <p className="flower-detail-feedback">
              {data.shopCount === 0 ? 'Cửa hàng chưa có đánh giá.' : 'Trang này không có đánh giá.'}
            </p>
          )}
          {(page > 1 || data.hasMore) && (
            <nav className="shop-reviews-pagination" aria-label="Phân trang đánh giá">
              {page > 1 && (
                <Link className="button button-outline" href={pageHref(page - 1)}>
                  Trang trước
                </Link>
              )}
              <span aria-current="page">Trang {page}</span>
              {data.hasMore && (
                <Link className="button button-outline" href={pageHref(page + 1)}>
                  Trang sau
                </Link>
              )}
            </nav>
          )}
        </>
      )}
    </main>
  );
}
