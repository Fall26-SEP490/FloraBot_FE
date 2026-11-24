'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { ImageIcon, Star, X } from '@florabot/ui';
import { request } from '@/shared/lib/api';
import { productReviewsQuery } from '../product-reviews.api';
import { RatingStars } from './RatingStars';

const scores = [1, 2, 3, 4, 5];
const scoreLabels = [
  'Rất không hài lòng',
  'Không hài lòng',
  'Bình thường',
  'Hài lòng',
  'Rất hài lòng',
];
const date = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
const imageTypes = ['image/jpeg', 'image/png', 'image/webp'];
const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp'];

function encodePhoto(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Không đọc được ảnh.'));
    reader.onload = () => resolve(String(reader.result).split(',', 2)[1]);
    reader.readAsDataURL(file);
  });
}

export function ProductReviews({
  productId,
  customerId,
}: {
  productId: string;
  customerId?: string;
}) {
  const queryClient = useQueryClient();
  const path = `/shop/products/${encodeURIComponent(productId)}`;
  const [page, setPage] = useState(1);
  const [stars, setStars] = useState(0);
  const [hoveredStars, setHoveredStars] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [photoError, setPhotoError] = useState('');
  const photoInput = useRef<HTMLInputElement>(null);
  const photoId = useId();
  const photoLabelId = useId();
  const photoHintId = useId();
  const photoErrorId = useId();
  const [sent, setSent] = useState(false);
  const eligibilityKey = ['flower-review-eligibility', productId, customerId];

  useEffect(
    () => () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    },
    [photoPreview],
  );

  function changePhoto(file: File | null) {
    const supported =
      file &&
      (imageTypes.includes(file.type) ||
        imageExtensions.some((extension) => file.name.toLowerCase().endsWith(extension)));
    const invalid = file && (!supported || file.size < 1 || file.size > 2 * 1024 * 1024);
    setPhoto(file);
    setPhotoError(invalid ? 'Chọn một ảnh JPEG, PNG hoặc WebP tối đa 2 MB.' : '');
    setPhotoPreview(file && !invalid ? URL.createObjectURL(file) : '');
  }

  const reviews = useQuery(productReviewsQuery(productId, page));
  const permission = useQuery({
    queryKey: eligibilityKey,
    queryFn: () => request<{ eligible: boolean }>(`${path}/review-eligibility`),
    enabled: Boolean(customerId),
    retry: false,
  });
  const submit = useMutation({
    mutationFn: async () =>
      request(`${path}/reviews`, {
        stars,
        comment: comment.trim() || null,
        photoBase64: photo ? await encodePhoto(photo) : null,
      }),
    onSuccess: async () => {
      setSent(true);
      setPage(1);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['flower-reviews'] }),
        queryClient.invalidateQueries({ queryKey: ['shop-flower-reviews'] }),
        queryClient.invalidateQueries({ queryKey: eligibilityKey }),
      ]);
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (permission.data?.eligible && stars && !photoError && !submit.isPending && !sent) {
      submit.mutate();
    }
  }

  return (
    <section className="flower-reviews" aria-labelledby="flower-reviews-title">
      <h2 id="flower-reviews-title" tabIndex={-1}>
        Đánh giá sản phẩm
      </h2>
      {reviews.isPending && <p>Đang tải đánh giá…</p>}
      {reviews.isError && (
        <p>
          Chưa tải được đánh giá.{' '}
          <button type="button" onClick={() => void reviews.refetch()}>
            Thử lại
          </button>
        </p>
      )}
      {reviews.data && (
        <>
          {reviews.data.items.length > 0 && (
            <ol className="flower-review-list">
              {reviews.data.items.map((item) => (
                <li key={item.id}>
                  <strong className="flower-review-author">
                    {item.reviewerName?.trim() || 'Khách hàng'}
                  </strong>
                  <div className="flower-review-meta">
                    <RatingStars value={item.stars} />
                    <time dateTime={item.createdAt}>{date.format(new Date(item.createdAt))}</time>
                  </div>
                  {item.comment && <p>{item.comment}</p>}
                  {item.photoUrl && (
                    <a href={item.photoUrl} target="_blank" rel="noreferrer">
                      <img
                        src={item.photoUrl}
                        alt="Ảnh hoa khách nhận"
                        width={112}
                        height={112}
                        loading="lazy"
                      />
                    </a>
                  )}
                </li>
              ))}
            </ol>
          )}
          {reviews.data.items.length === 0 && (
            <p className="flower-review-empty">Chưa có đánh giá cho mẫu hoa này.</p>
          )}
          {(page > 1 || reviews.data.hasMore) && (
            <div className="flower-review-pagination">
              <button
                type="button"
                disabled={page === 1}
                onClick={() => setPage((value) => value - 1)}
              >
                Trang trước
              </button>
              <span>Trang {page}</span>
              <button
                type="button"
                disabled={!reviews.data.hasMore}
                onClick={() => setPage((value) => value + 1)}
              >
                Trang sau
              </button>
            </div>
          )}
        </>
      )}
      {sent && <p role="status">Đã gửi đánh giá. Cảm ơn bạn!</p>}
      {permission.isError && (
        <p>
          Chưa kiểm tra được quyền đánh giá.{' '}
          <button type="button" onClick={() => void permission.refetch()}>
            Thử lại
          </button>
        </p>
      )}
      {customerId && permission.data?.eligible === false && !sent && (
        <p>Bạn có thể đánh giá mẫu này một lần sau khi nhận hoa đã đặt trước.</p>
      )}
      {permission.data?.eligible && !sent && (
        <form className="flower-review-form" onSubmit={handleSubmit}>
          <fieldset disabled={submit.isPending}>
            <legend>Đánh giá của bạn</legend>
            <div className="flower-review-score-row">
              <div
                className="flower-review-scores"
                role="radiogroup"
                aria-label="Chọn số sao đánh giá"
              >
                {scores.map((score) => (
                  <label
                    key={score}
                    className={score <= (hoveredStars ?? stars) ? 'is-filled' : undefined}
                    title={`${score} sao`}
                  >
                    <input
                      type="radio"
                      name="flower-rating"
                      value={score}
                      aria-label={`${score} sao`}
                      onMouseEnter={() => setHoveredStars(score)}
                      onMouseLeave={() => setHoveredStars(null)}
                      checked={stars === score}
                      onChange={() => setStars(score)}
                    />
                    <Star size={22} strokeWidth={1.6} aria-hidden="true" />
                  </label>
                ))}
              </div>
              <p className="flower-review-score-caption" aria-live="polite" aria-atomic="true">
                {stars ? scoreLabels[stars - 1] : 'Chọn số sao để gửi đánh giá.'}
              </p>
            </div>
            <label>
              Bình luận{' '}
              <textarea
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                maxLength={1000}
                rows={3}
              />
            </label>
            <div className="flower-review-photo">
              <span id={photoLabelId}>
                Ảnh hoa đã nhận <span className="flower-review-optional">(không bắt buộc)</span>
              </span>
              <div className="flower-review-photo-controls">
                <label className="flower-review-photo-picker" htmlFor={photoId}>
                  <ImageIcon size={16} aria-hidden="true" />
                  <span>{photo ? 'Đổi ảnh' : 'Thêm ảnh'}</span>
                  <input
                    id={photoId}
                    ref={photoInput}
                    type="file"
                    aria-labelledby={photoLabelId}
                    aria-describedby={`${photoHintId}${photoError ? ` ${photoErrorId}` : ''}`}
                    aria-invalid={Boolean(photoError)}
                    accept={[...imageTypes, ...imageExtensions].join(',')}
                    onChange={(event) => changePhoto(event.target.files?.[0] ?? null)}
                  />
                </label>
                {photo && (
                  <button
                    type="button"
                    onClick={() => {
                      changePhoto(null);
                      if (photoInput.current) {
                        photoInput.current.value = '';
                        photoInput.current.focus();
                      }
                    }}
                    aria-label="Bỏ ảnh đã chọn"
                  >
                    <X size={16} aria-hidden="true" /> Bỏ ảnh
                  </button>
                )}
              </div>
              {photo && (
                <div className="flower-review-photo-preview">
                  {photoPreview && (
                    <img src={photoPreview} alt="Ảnh đã chọn để đánh giá" width={80} height={80} />
                  )}
                  <span>{photo.name}</span>
                </div>
              )}
              <small id={photoHintId}>JPG, PNG, WebP · tối đa 2 MB</small>
            </div>
            <small>Bình luận và ảnh sẽ hiển thị công khai.</small>
          </fieldset>
          {photoError && (
            <p id={photoErrorId} role="alert">
              {photoError}
            </p>
          )}
          {submit.isError && (
            <p role="alert">
              {submit.error instanceof Error ? submit.error.message : 'Chưa gửi được đánh giá.'}
            </p>
          )}
          <button type="submit" disabled={!stars || Boolean(photoError) || submit.isPending}>
            {submit.isPending ? 'Đang gửi…' : 'Gửi đánh giá'}
          </button>
        </form>
      )}
    </section>
  );
}
