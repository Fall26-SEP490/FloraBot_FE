'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@florabot/ui';
import { fetchLandingCatalog } from './landing-api';
import { priceVnd, safePublicUrl } from './landing-data';

export default function StorefrontFlowers() {
  const [failedPhotos, setFailedPhotos] = useState<Set<string>>(() => new Set());
  // This is a preview; budget links open the catalog, which loads every API page.
  const catalog = useQuery({
    queryKey: ['landing-catalog-preview'],
    queryFn: () => fetchLandingCatalog(1),
  });
  const items = [
    ...new Map(
      (catalog.data?.items ?? []).map((item) => [`${item.productId}:${item.kioskId}`, item]),
    ).values(),
  ].slice(0, 6);

  return (
    <section
      id="mau-hoa"
      className="section storefront-flowers"
      aria-labelledby="storefront-flowers-title"
    >
      <div className="storefront-section-heading">
        <div>
          <h2 id="storefront-flowers-title">Mẫu hoa từ các shop</h2>
          <p id="storefront-price-note">
            Giá hiển thị là giá mẫu. Bạn chỉ thanh toán sau khi xác nhận báo giá từ shop.
          </p>
        </div>
        <Link className="text-link" href="/dat-hoa">
          Xem tất cả mẫu
        </Link>
      </div>
      <nav className="storefront-budgets" aria-label="Chọn hoa theo ngân sách">
        <Link href="/dat-hoa?price=under300">Dưới 300.000 đ</Link>
        <Link href="/dat-hoa?price=300to600">300.000–600.000 đ</Link>
        <Link href="/dat-hoa?price=600to1000">Trên 600.000–1.000.000 đ</Link>
      </nav>
      <div className="storefront-results" aria-busy={catalog.isFetching}>
        {catalog.isPending && (
          <div className="storefront-feedback" role="status">
            <p>Đang tải mẫu hoa từ các shop…</p>
            <div className="storefront-placeholder-row" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
          </div>
        )}
        {catalog.isError && !catalog.data && (
          <div className="storefront-feedback" role="alert">
            <h3>Chưa tải được mẫu hoa</h3>
            <p>Bạn vẫn có thể tìm kiosk hoặc thử tải lại danh sách.</p>
            <Button variant="outline" onClick={() => void catalog.refetch()}>
              Tải lại mẫu hoa trên trang chủ
            </Button>
          </div>
        )}
        {catalog.isSuccess && items.length === 0 && (
          <p role="status" className="storefront-feedback">
            Hiện chưa có mẫu hoa để hiển thị.
          </p>
        )}
        {items.length > 0 && (
          <ul className="storefront-flower-grid">
            {items.map((item) => {
              const key = `${item.productId}:${item.kioskId}`;
              const photo = safePublicUrl(item.photo);
              return (
                <li key={key}>
                  <Link
                    className="storefront-flower"
                    href={`/dat-hoa/${encodeURIComponent(item.productId)}/${encodeURIComponent(item.kioskId)}`}
                    aria-label={`Xem mẫu ${item.name}`}
                    aria-describedby="storefront-price-note"
                  >
                    <div className="storefront-flower-photo">
                      {photo && !failedPhotos.has(photo) ? (
                        <img
                          src={photo}
                          alt={item.name}
                          width={480}
                          height={540}
                          loading="lazy"
                          onError={() =>
                            setFailedPhotos((previous) => new Set(previous).add(photo))
                          }
                        />
                      ) : (
                        <span>{photo ? 'Chưa tải được ảnh' : 'Shop chưa có ảnh mẫu'}</span>
                      )}
                    </div>
                    <div className="storefront-flower-copy">
                      <h3>{item.name}</h3>
                      <p className="storefront-flower-price">{priceVnd(item.price)}</p>
                      <p className="storefront-flower-shop" title={item.shopName}>
                        {item.shopName || 'Chưa có tên shop'}
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <noscript>
        <p>
          Bật JavaScript để xem mẫu hoa, hoặc <a href="/dat-hoa">mở danh sách hoa</a>.
        </p>
      </noscript>
    </section>
  );
}
