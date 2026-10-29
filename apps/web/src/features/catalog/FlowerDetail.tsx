'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Button, MapPin, MessageSquare, Store } from '@florabot/ui';
import { request } from '@/shared/lib/api';
import { MOCK_CATALOG_ITEMS } from './mocks/mockCatalog';
import type { CatalogItem, CatalogResponse } from './catalog.types';
import { canOrderOnWeb, formatPrice, purchaseLabel } from './catalog.utils';
import { FlowerRequestPanel } from './components/FlowerRequestPanel';
import './styles/catalog.css';

async function findItem(productId: string, kioskId: string): Promise<CatalogItem | null> {
  for (let page = 1; page <= 100000; page++) {
    const response = await request<CatalogResponse>(`/shop/catalog?page=${page}&search=`);
    const item = response.items.find(
      (entry) => entry.productId === productId && entry.kioskId === kioskId,
    );
    if (item) return item;
    if (!response.hasMore) return null;
  }
  throw new Error('Không thể tải thêm sản phẩm. Vui lòng thử lại.');
}

export default function FlowerDetail({
  productId,
  kioskId,
}: {
  productId: string;
  kioskId: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<CatalogItem | null>(null);
  const [failedPhoto, setFailedPhoto] = useState<string | null>(null);
  const [demo] = useState(
    () =>
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('demo') === '1',
  );
  const query = useQuery({
    queryKey: ['web-catalog-detail', productId, kioskId, demo],
    queryFn: async () =>
      demo
        ? (MOCK_CATALOG_ITEMS.filter(
            (item) => item.productId === productId && item.kioskId === kioskId,
          ).map((item) => ({ ...item, isDemoSample: true }))[0] ?? null)
        : findItem(productId, kioskId),
  });
  const item = query.data;
  const openChat = (flower: CatalogItem) => {
    if (flower.isDemoSample) return;
    const params = new URLSearchParams({
      action: 'chat',
      sellerId: flower.sellerId,
      productId: flower.productId,
      shopName: flower.shopName,
      name: flower.name,
    });
    router.push(`/dat-hoa?${params}`);
  };
  return (
    <main id="main" className="flower-shop-page flower-detail-page">
      <Link className="flower-detail-back" href={demo ? '/dat-hoa?demo=1' : '/dat-hoa'}>
        <ArrowLeft size={16} aria-hidden="true" /> Quay lại danh mục
      </Link>
      {query.isPending && <p role="status">Đang tải thông tin mẫu hoa…</p>}
      {query.isError && (
        <div role="alert">
          <p>Không thể tải thông tin mẫu hoa.</p>
          <Button onClick={() => void query.refetch()}>Thử lại</Button>
        </div>
      )}
      {!query.isPending && !query.isError && !item && (
        <p role="status">Mẫu hoa không còn trong danh mục tại kiosk này.</p>
      )}
      {item && (
        <article className="flower-detail">
          <div className="flower-detail-layout">
            <figure className="flower-detail-media">
              <img
                src={
                  item.photo && failedPhoto !== item.photo
                    ? item.photo
                    : '/images/floral-white-online.webp'
                }
                alt={item.photo && failedPhoto !== item.photo ? item.name : 'Ảnh minh họa hoa'}
                onError={() => {
                  if (item.photo) setFailedPhoto(item.photo);
                }}
              />
              {(!item.photo || failedPhoto === item.photo) && (
                <figcaption>Ảnh minh họa · Shop chưa có ảnh sản phẩm hiển thị</figcaption>
              )}
            </figure>
            <div className="flower-detail-content">
              <p className="flower-detail-eyebrow">Mẫu hoa · {item.shopName}</p>
              <span className="flower-detail-badge">{purchaseLabel(item)}</span>
              <h1>{item.name}</h1>
              <div className="flower-detail-pricing">
                <span className="flower-detail-price">{formatPrice(item.price)} đ</span>
                <span>Giá mẫu tham khảo</span>
              </div>
              {canOrderOnWeb(item) && (
                <p className="flower-detail-note">
                  Giá và thời gian nhận sẽ được shop xác nhận sau khi bạn gửi yêu cầu.
                </p>
              )}
              <div className="flower-detail-actions">
                {canOrderOnWeb(item) && <Button onClick={() => setSelected(item)}>Đặt hoa</Button>}
                <Button
                  variant="outline"
                  onClick={() => openChat(item)}
                  disabled={item.isDemoSample}
                >
                  <MessageSquare size={17} aria-hidden="true" /> Chat với shop
                </Button>
              </div>
              {item.isDemoSample && (
                <p className="flower-detail-note">Đây là mẫu minh họa, không tạo đơn thật.</p>
              )}
            </div>
          </div>
          <div className="flower-detail-info">
            <section
              className="flower-detail-description"
              aria-labelledby="flower-description-title"
            >
              <p className="flower-detail-eyebrow">Về mẫu hoa</p>
              <h2 id="flower-description-title">Mô tả sản phẩm</h2>
              <p>{item.description?.trim() || 'Shop chưa cung cấp mô tả cho mẫu hoa này.'}</p>
            </section>
            <section className="flower-detail-location" aria-labelledby="flower-location-title">
              <p className="flower-detail-eyebrow">Thông tin nhận hoa</p>
              <h2 id="flower-location-title">Cửa hàng & kiosk</h2>
              <div className="flower-detail-info-row">
                <Store size={19} aria-hidden="true" />
                <div>
                  <span>Cửa hàng</span>
                  <strong>{item.shopName || 'Chưa có thông tin'}</strong>
                </div>
              </div>
              <div className="flower-detail-info-row">
                <MapPin size={19} aria-hidden="true" />
                <div>
                  <span>Kiosk</span>
                  <strong>{item.kioskName || 'Chưa có thông tin'}</strong>
                  <p>{item.address || 'Chưa có địa chỉ'}</p>
                </div>
              </div>
            </section>
          </div>
        </article>
      )}
      <FlowerRequestPanel
        selected={selected}
        onClose={() => setSelected(null)}
        onOpenChat={openChat}
        openingChatId={null}
      />
    </main>
  );
}
