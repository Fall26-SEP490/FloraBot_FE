'use client';
import { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Button } from '@florabot/ui';
import { flowerPhotos } from '@florabot/ui/flower-photos';
import { fetchLandingCatalog } from './landing-api';
import { budgetSuggestions, priceVnd, safePublicUrl } from './landing-data';
export default function GiftDemo() {
  const [budget, setBudget] = useState(300000);
  const [submitted, setSubmitted] = useState(false);
  const catalog = useInfiniteQuery({
    queryKey: ['landing-web-catalog'],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => fetchLandingCatalog(pageParam),
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
  });
  const items = catalog.data?.pages.flatMap((page) => page.items) ?? [];
  const suggestions = submitted ? budgetSuggestions(items, budget) : [];
  return (
    <div className="gift-demo" aria-busy={catalog.isPending || catalog.isFetchingNextPage}>
      <div className="gift-picker">
        <div className="gift-picker-art">
          <h3 id="gift-picker-title">Chọn hoa theo ngân sách</h3>
          <img
            src={flowerPhotos.pastelBouquet.src}
            alt="Bó hoa minh họa cho mục gợi ý"
            width={flowerPhotos.pastelBouquet.width}
            height={flowerPhotos.pastelBouquet.height}
            loading="lazy"
          />
        </div>
        <form
          aria-labelledby="gift-picker-title"
          onSubmit={(event) => {
            event.preventDefault();
            setSubmitted(true);
          }}
        >
          <p>
            Gợi ý theo giá của các mẫu đặt qua web đã tải. Shop xác nhận báo giá và lịch nhận sau
            khi bạn gửi yêu cầu.
          </p>
          <fieldset className="gift-budget">
            <legend>Ngân sách tối đa</legend>
            <div className="budget-options">
              {[300000, 500000, 700000].map((value) => (
                <button
                  type="button"
                  key={value}
                  aria-label={priceVnd(value)}
                  aria-pressed={budget === value}
                  onClick={() => {
                    setBudget(value);
                    setSubmitted(false);
                  }}
                >
                  {priceVnd(value)}
                </button>
              ))}
            </div>
          </fieldset>
          <Button type="submit" disabled={!catalog.data || items.length === 0}>
            Xem gợi ý hoa
          </Button>
        </form>
      </div>
      {catalog.isPending && (
        <p role="status" className="landing-data-status">
          Đang tải mẫu hoa từ các shop…
        </p>
      )}
      {catalog.isError && !catalog.data ? (
        <div role="alert" className="landing-data-status">
          <p>Chưa tải được mẫu hoa. Không có gợi ý để hiển thị.</p>
          <Button variant="outline" onClick={() => void catalog.refetch()}>
            Tải lại mẫu hoa
          </Button>
        </div>
      ) : catalog.isSuccess && !items.length && !catalog.hasNextPage ? (
        <p role="status" className="landing-data-status">
          Hiện chưa có mẫu hoa để gợi ý.
        </p>
      ) : null}
      {submitted && catalog.data && (
        <p role="status" className="gift-status">
          {suggestions.length
            ? `${suggestions.length} gợi ý trong ${items.length} mẫu đã tải, tối đa ${priceVnd(budget)}.`
            : 'Chưa có mẫu phù hợp ngân sách trong các trang đã tải.'}
          {catalog.hasNextPage ? ' Còn mẫu khác; bạn có thể tải thêm.' : ''}
        </p>
      )}
      {suggestions.length > 0 && (
        <ul className="gift-results">
          {suggestions.map((item) => (
            <li key={`${item.productId}:${item.kioskId}`}>
              {safePublicUrl(item.photo) ? (
                <img
                  src={safePublicUrl(item.photo)!}
                  alt={item.name}
                  width={480}
                  height={360}
                  loading="lazy"
                />
              ) : (
                <div className="gift-photo-empty">Chưa có ảnh sản phẩm</div>
              )}
              <div className="gift-result-copy">
                <h3>{item.name}</h3>
                <p>{priceVnd(item.price)} · giá mẫu tham khảo</p>
                <p className="gift-shop">{item.shopName}</p>
                <p className="gift-kiosk">Nhận tại {item.kioskName}</p>
                <p>{item.address}</p>
                <a
                  className="text-link"
                  href={`/dat-hoa/${encodeURIComponent(item.productId)}/${encodeURIComponent(item.kioskId)}`}
                >
                  Xem mẫu {item.name}
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}
      {catalog.isFetchingNextPage && <p role="status">Đang tải thêm mẫu hoa…</p>}
      {catalog.isFetchNextPageError && (
        <p role="alert">Chưa tải được trang tiếp theo. Các mẫu đã tải vẫn được giữ; hãy thử lại.</p>
      )}
      {catalog.hasNextPage && (
        <Button
          variant="outline"
          disabled={catalog.isFetching}
          onClick={() => void catalog.fetchNextPage()}
        >
          {catalog.isFetchingNextPage ? 'Đang tải thêm mẫu…' : 'Tải thêm mẫu hoa'}
        </Button>
      )}
      <a className="text-link" href="/dat-hoa">
        Xem danh mục đặt hoa
      </a>
    </div>
  );
}
