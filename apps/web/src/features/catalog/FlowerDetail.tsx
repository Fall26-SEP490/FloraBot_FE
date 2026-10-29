'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Button, MapPin, MessageSquare, Store } from '@florabot/ui';
import { request, sessionQuery } from '@/shared/lib/api';
import { MOCK_CATALOG_ITEMS } from './mocks/mockCatalog';
import type { CatalogItem, CatalogResponse } from './catalog.types';
import { canOrderOnWeb, formatPrice, purchaseLabel } from './catalog.utils';
import { FlowerRequestPanel } from './components/FlowerRequestPanel';
import { ChatNoticeDialog, type ChatNotice } from './components/ChatNoticeDialog';
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
  const session = useQuery(sessionQuery);
  const [selected, setSelected] = useState<CatalogItem | null>(null);
  const [chatNotice, setChatNotice] = useState<ChatNotice | null>(null);
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
    setSelected(null);
    const params = new URLSearchParams({
      action: 'chat',
      sellerId: flower.sellerId,
      productId: flower.productId,
      shopName: flower.shopName,
      name: flower.name,
    });
    const returnUrl = `/dat-hoa?${params}`;
    if (!session.data) {
      setChatNotice({ kind: 'login', returnUrl });
      return;
    }
    if (session.data.role !== 'CUSTOMER') {
      setChatNotice({ kind: 'role' });
      return;
    }
    router.push(returnUrl);
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
              <div className="flower-detail-header-meta">
                <span className="flower-detail-badge">{purchaseLabel(item)}</span>
                {item.occasion && (
                  <span className="flower-detail-badge flower-detail-badge-occasion">
                    {item.occasion}
                  </span>
                )}
              </div>
              <h1>{item.name}</h1>
              <div className="flower-detail-pricing">
                <span className="flower-detail-price">{formatPrice(item.price)} đ</span>
                <span className="flower-detail-price-sub">Giá mẫu tham khảo</span>
              </div>

              <div className="flower-detail-divider" aria-hidden="true" />

              <section
                className="flower-detail-description"
                aria-labelledby="flower-description-title"
              >
                <h2 id="flower-description-title">Mô tả sản phẩm</h2>
                <p>{item.description?.trim() || 'Shop chưa cung cấp mô tả cho mẫu hoa này.'}</p>
              </section>

              <section className="flower-detail-location" aria-labelledby="flower-location-title">
                <h2 id="flower-location-title">Cửa hàng & kiosk</h2>
                <div className="flower-detail-location-body">
                  <div className="flower-detail-info-row">
                    <div className="flower-detail-info-icon" aria-hidden="true">
                      <Store size={18} />
                    </div>
                    <div className="flower-detail-info-content">
                      <span>Cửa hàng</span>
                      <strong>{item.shopName || 'Chưa có thông tin'}</strong>
                    </div>
                  </div>
                  <div className="flower-detail-info-row">
                    <div className="flower-detail-info-icon" aria-hidden="true">
                      <MapPin size={18} />
                    </div>
                    <div className="flower-detail-info-content">
                      <span>Kiosk nhận hoa</span>
                      <strong>{item.kioskName || 'Chưa có thông tin'}</strong>
                      <p>{item.address || 'Chưa có địa chỉ'}</p>
                    </div>
                  </div>
                </div>
              </section>

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

              {canOrderOnWeb(item) && (
                <p className="flower-detail-note">
                  Giá và thời gian nhận sẽ được shop xác nhận sau khi bạn gửi yêu cầu.
                </p>
              )}

              {item.isDemoSample && (
                <p className="flower-detail-demo-note">Đây là mẫu minh họa, không tạo đơn thật.</p>
              )}
            </div>
          </div>
        </article>
      )}
      <FlowerRequestPanel
        selected={selected}
        onClose={() => setSelected(null)}
        onOpenChat={openChat}
        openingChatId={null}
      />
      <ChatNoticeDialog
        notice={chatNotice}
        onClose={() => setChatNotice(null)}
        onLogin={(returnUrl) =>
          router.push(`/dang-nhap?returnUrl=${encodeURIComponent(returnUrl)}`)
        }
      />
    </main>
  );
}
