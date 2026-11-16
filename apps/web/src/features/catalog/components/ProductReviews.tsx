'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { request } from '@/shared/lib/api';
import '../styles/product-reviews.css';

type Review = {
  id: string;
  stars: number;
  comment: string | null;
  photoUrl: string | null;
  createdAt: string;
};

type ReviewPage = {
  productAverage: number | null;
  productCount: number;
  shopAverage: number | null;
  shopCount: number;
  items: Review[];
  hasMore: boolean;
};

const scores = [1, 2, 3, 4, 5];
const average = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 });
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
  const [comment, setComment] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoError, setPhotoError] = useState('');
  const [sent, setSent] = useState(false);
  const publicKey = ['flower-reviews', productId];
  const eligibilityKey = ['flower-review-eligibility', productId, customerId];

  const reviews = useQuery({
    queryKey: [...publicKey, page],
    queryFn: async () => {
      const result = await request<ReviewPage>(`${path}/reviews?page=${page}`);
      if (!Array.isArray(result?.items)) throw new Error('Dữ liệu đánh giá không hợp lệ.');
      return result;
    },
    retry: false,
  });
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
      <h2 id="flower-reviews-title">Đánh giá sản phẩm</h2>
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
          <dl className="flower-review-summary">
            <div>
              <dt>Mẫu hoa</dt>
              <dd>
                {reviews.data.productAverage == null
                  ? 'Chưa có đánh giá'
                  : `${average.format(reviews.data.productAverage)}/5 sao · ${reviews.data.productCount} lượt`}
              </dd>
            </div>
            <div>
              <dt>Điểm shop</dt>
              <dd>
                {reviews.data.shopAverage == null
                  ? 'Chưa có đánh giá'
                  : `${average.format(reviews.data.shopAverage)}/5 sao · ${reviews.data.shopCount} lượt`}
              </dd>
            </div>
          </dl>
          {reviews.data.items.length > 0 && (
            <ol className="flower-review-list">
              {reviews.data.items.map((item) => (
                <li key={item.id}>
                  <div className="flower-review-meta">
                    <span role="img" aria-label={`${item.stars} trên 5 sao`}>
                      <span aria-hidden="true">
                        {'★'.repeat(item.stars)}
                        {'☆'.repeat(5 - item.stars)}
                      </span>
                    </span>
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
            <div className="flower-review-scores">
              {scores.map((score) => (
                <label key={score}>
                  <input
                    type="radio"
                    name="flower-rating"
                    value={score}
                    checked={stars === score}
                    onChange={() => setStars(score)}
                  />
                  <span>{score} sao</span>
                </label>
              ))}
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
            <label>
              Ảnh hoa đã nhận{' '}
              <input
                type="file"
                accept={[...imageTypes, ...imageExtensions].join(',')}
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  const supported =
                    file &&
                    (imageTypes.includes(file.type) ||
                      imageExtensions.some((extension) =>
                        file.name.toLowerCase().endsWith(extension),
                      ));
                  setPhoto(file);
                  setPhotoError(
                    file && (!supported || file.size < 1 || file.size > 2 * 1024 * 1024)
                      ? 'Chọn một ảnh JPEG, PNG hoặc WebP tối đa 2 MB.'
                      : '',
                  );
                }}
              />
            </label>
            <small>Bình luận và ảnh sẽ hiển thị công khai.</small>
          </fieldset>
          {photoError && <p role="alert">{photoError}</p>}
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
