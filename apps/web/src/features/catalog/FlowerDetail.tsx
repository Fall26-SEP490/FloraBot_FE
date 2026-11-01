'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { catalogReturnPath } from './catalog.navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Button, MapPin, MessageSquare, Store } from '@florabot/ui';
import { request, sessionQuery } from '@/shared/lib/api';
import { MOCK_CATALOG_ITEMS } from './mocks/mockCatalog';
import type { CatalogItem, CatalogResponse } from './catalog.types';
import { canOrderOnWeb, formatPrice, isWalkIn, purchaseLabel } from './catalog.utils';
import { FlowerRequestPanel } from './components/FlowerRequestPanel';
import { ChatNoticeDialog } from './components/ChatNoticeDialog';
import { useCustomerChat } from './hooks/useCustomerChat';
import './styles/catalog.css';

async function findItem(
  productId: string,
  kioskId: string,
  zone?: string,
): Promise<CatalogItem | null> {
  let walkInFallback: CatalogItem | null = null;
  for (let page = 1; page <= 100000; page++) {
    const response = await request<CatalogResponse>(`/shop/catalog?page=${page}&search=`);
    const matches = response.items.filter(
      (entry) => entry.productId === productId && entry.kioskId === kioskId,
    );
    if (zone !== undefined) {
      const item = matches.find((entry) => entry.zone === zone);
      if (item) return item;
    } else {
      const webItem = matches.find((entry) => entry.zone == null || entry.zone === 'PREORDER');
      if (webItem) return webItem;
      walkInFallback ??= matches[0] ?? null;
    }
    if (!response.hasMore) return walkInFallback;
  }
  throw new Error('Không thể tải thêm sản phẩm. Vui lòng thử lại.');
}

export default function FlowerDetail({
  productId,
  kioskId,
  zone,
}: {
  productId: string;
  kioskId: string;
  zone?: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const backHref = catalogReturnPath(
    params.get('from') ?? (params.get('demo') === '1' ? '/dat-hoa?demo=1' : null),
  );
  const session = useQuery(sessionQuery);
  const [selected, setSelected] = useState<CatalogItem | null>(null);
  const [resumeOrder, setResumeOrder] = useState(
    () =>
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('order') === '1',
  );
  const [failedPhoto, setFailedPhoto] = useState<string | null>(null);
  const [demo] = useState(
    () =>
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('demo') === '1',
  );
  const query = useQuery({
    queryKey: ['web-catalog-detail', productId, kioskId, zone, demo],
    queryFn: async () =>
      demo
        ? (MOCK_CATALOG_ITEMS.filter(
            (item) => item.productId === productId && item.kioskId === kioskId,
          ).map((item) => ({ ...item, isDemoSample: true }))[0] ?? null)
        : findItem(productId, kioskId, zone),
  });
  const item = query.data;
  const resumedItem =
    resumeOrder && item && session.data?.role === 'CUSTOMER' && canOrderOnWeb(item) ? item : null;
  useEffect(() => {
    if (!resumedItem) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get('order') !== '1') return;
    url.searchParams.delete('order');
    window.history.replaceState(window.history.state, '', url.pathname + url.search);
  }, [resumedItem]);
  const selectItem = (next: CatalogItem | null) => {
    setResumeOrder(false);
    setSelected(next);
  };
  const {
    handleOpenChat: openChat,
    openingChatId,
    chatNotice,
    setChatNotice,
  } = useCustomerChat(selectItem);
  return (
    <main id="main" className="flower-shop-page flower-detail-page">
      <Link className="flower-detail-back" href={backHref}>
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
              <p className="flower-detail-shop">
                <Store size={16} aria-hidden="true" />
                {item.shopName || 'Shop chưa cập nhật tên'}
              </p>
              <div className="flower-detail-pricing">
                <span className="flower-detail-price">{formatPrice(item.price)} đ</span>
                <span className="flower-detail-price-sub">
                  {isWalkIn(item) ? 'Giá niêm yết tại tủ' : 'Giá mẫu'}
                </span>
              </div>

              {canOrderOnWeb(item) && (
                <p className="flower-detail-note">
                  Shop sẽ báo giá theo yêu cầu và xác nhận lịch nhận trước khi bạn thanh toán.
                </p>
              )}

              <div className="flower-detail-actions">
                {canOrderOnWeb(item) ? (
                  <Button onClick={() => selectItem(item)}>Yêu cầu báo giá</Button>
                ) : isWalkIn(item) ? (
                  <Link
                    className="button button-primary"
                    href={`/tim-kiosk?kiosk=${encodeURIComponent(item.kioskId)}`}
                  >
                    Xem tủ để mua trực tiếp
                  </Link>
                ) : null}
                <Button
                  variant="outline"
                  onClick={() => openChat(item)}
                  disabled={item.isDemoSample || openingChatId !== null}
                >
                  <MessageSquare size={17} aria-hidden="true" />{' '}
                  {openingChatId ? 'Đang mở chat…' : 'Chat với shop'}
                </Button>
              </div>

              <section className="flower-detail-location" aria-labelledby="flower-location-title">
                <h2 id="flower-location-title">Nơi nhận hoa</h2>
                <div className="flower-detail-location-body">
                  <div className="flower-detail-info-row">
                    <div className="flower-detail-info-icon" aria-hidden="true">
                      <MapPin size={18} />
                    </div>
                    <div className="flower-detail-info-content">
                      <strong>{item.kioskName || 'Chưa có thông tin'}</strong>
                      <p>{item.address || 'Chưa có địa chỉ'}</p>
                    </div>
                  </div>
                </div>
              </section>

              <section
                className="flower-detail-description"
                aria-labelledby="flower-description-title"
              >
                <h2 id="flower-description-title">Mô tả sản phẩm</h2>
                <p>{item.description?.trim() || 'Shop chưa cung cấp mô tả cho mẫu hoa này.'}</p>
              </section>

              {canOrderOnWeb(item) && (
                <p className="flower-detail-help">
                  Hoa đặt trước được shop chuẩn bị theo yêu cầu.{' '}
                  <Link href="/huong-dan-dat-hoa">Xem cách đặt và nhận hoa</Link>
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
        selected={selected ?? resumedItem}
        onClose={() => selectItem(null)}
        onOpenChat={openChat}
        openingChatId={openingChatId}
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
