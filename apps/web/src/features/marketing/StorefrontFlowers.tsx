'use client';

import { FlowerGridSkeleton } from '@/shared/components/PageSkeleton';
import IconActionButton from '@/shared/components/IconActionButton';
import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';

import { loadCatalog } from '@/features/catalog/catalog.data';
import {
  catalogCardKey,
  isPreorder,
  isPreorderSoldOut,
  isWalkIn,
  purchaseLabel,
  uniqueCatalogCards,
} from '@/features/catalog/catalog.utils';
import { fetchLandingCatalog } from './landing-api';
import { priceVnd, safePublicUrl } from './landing-data';

export default function StorefrontFlowers() {
  const [selected, setSelected] = useState('preorder');
  const [failedPhotos, setFailedPhotos] = useState<Set<string>>(() => new Set());
  const catalog = useQuery({
    queryKey: ['landing-catalog-preview'],
    queryFn: async () => uniqueCatalogCards(await loadCatalog(fetchLandingCatalog)),
  });
  const items = catalog.data ?? [];
  const groups = [
    { id: 'preorder', title: 'Hoa đặt trước', flowers: items.filter(isPreorder) },
    { id: 'walk-in', title: 'Mua tại kiosk', flowers: items.filter(isWalkIn) },
    {
      id: 'other',
      title: 'Mẫu hoa khác',
      flowers: items.filter((item) => !isWalkIn(item) && !isPreorder(item)),
    },
  ].filter((group) => group.flowers.length > 0);
  const activeGroup = groups.find((group) => group.id === selected) ?? groups[0];

  return (
    <section
      id="mau-hoa"
      className="section storefront-flowers"
      aria-labelledby="storefront-flowers-title"
    >
      <div className="storefront-section-heading">
        <h2 id="storefront-flowers-title">Mẫu hoa từ các shop</h2>
        <Link href="/dat-hoa" className="collection-view-all-btn">
          Xem tất cả mẫu <span aria-hidden="true">→</span>
        </Link>
      </div>
      <div className="storefront-results" aria-busy={catalog.isFetching}>
        {catalog.isPending && (
          <FlowerGridSkeleton gridClassName="storefront-flower-grid" count={4} />
        )}
        {catalog.isError && !catalog.data && (
          <div className="storefront-feedback" role="alert">
            <h3>Chưa tải được mẫu hoa</h3>
            <p>Bạn vẫn có thể tìm kiosk hoặc thử tải lại danh sách.</p>
            <IconActionButton
              variant="outline"
              onClick={() => void catalog.refetch()}
              action="reload"
              label="Tải lại mẫu hoa trên trang chủ"
            />
          </div>
        )}
        {catalog.isSuccess && items.length === 0 && (
          <p role="status" className="storefront-feedback">
            Hiện chưa có mẫu hoa để hiển thị. Hãy quay lại sau hoặc tìm kiosk gần bạn.
          </p>
        )}
        {activeGroup && (
          <section className="storefront-collection" aria-label={activeGroup.title}>
            {groups.length === 1 ? (
              <h3 className="storefront-mode-label">{activeGroup.title}</h3>
            ) : (
              <div className="storefront-mode-switch" role="group" aria-label="Hình thức mua hoa">
                {groups.map((group) => (
                  <button
                    type="button"
                    key={group.id}
                    aria-pressed={group.id === activeGroup.id}
                    onClick={() => setSelected(group.id)}
                  >
                    {group.title}
                  </button>
                ))}
              </div>
            )}
            <ul className="storefront-flower-grid">
              {activeGroup.flowers.slice(0, 10).map((item) => {
                const kioskName = isPreorder(item) ? '' : item.kioskName;
                const photo = safePublicUrl(item.photo);
                const illustrative = !photo || failedPhotos.has(photo);
                return (
                  <li key={catalogCardKey(item)}>
                    <Link
                      className="storefront-flower"
                      href={`/dat-hoa/${encodeURIComponent(item.productId)}/${encodeURIComponent(item.kioskId)}${item.zone ? `?zone=${encodeURIComponent(item.zone)}` : ''}`}
                      aria-label={[item.name, purchaseLabel(item), kioskName]
                        .filter(Boolean)
                        .join(' · ')}
                    >
                      <div className="storefront-flower-photo">
                        <img
                          src={illustrative ? '/images/floral-white-online.webp' : photo!}
                          alt={
                            illustrative
                              ? 'Ảnh hoa minh họa, chưa có ảnh sản phẩm'
                              : `Mẫu ${item.name} từ ${item.shopName}`
                          }
                          width={480}
                          height={480}
                          loading="lazy"
                          onError={() => {
                            if (photo && !illustrative) {
                              setFailedPhotos((previous) => new Set(previous).add(photo));
                            }
                          }}
                        />
                        {illustrative && (
                          <span className="storefront-flower-illustration">Ảnh minh họa</span>
                        )}
                      </div>
                      <div className="storefront-flower-copy">
                        <h4>{item.name}</h4>
                        <p className="storefront-flower-price">
                          {priceVnd(item.price)}{' '}
                          <small>
                            {isWalkIn(item) ? 'Giá tại tủ' : isPreorder(item) ? 'Giá mẫu' : ''}
                          </small>
                        </p>
                        {isPreorderSoldOut(item) && (
                          <p className="storefront-flower-availability">Hết hàng</p>
                        )}
                        <p className="storefront-flower-shop" title={item.shopName}>
                          {[item.shopName, kioskName].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
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
