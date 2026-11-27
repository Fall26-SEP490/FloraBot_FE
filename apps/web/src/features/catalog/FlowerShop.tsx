'use client';

import { useEffect, useMemo, useState } from 'react';
import './styles/catalog.css';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { catalogReturnPath, shopCatalogPath } from './catalog.navigation';
import { useQuery } from '@tanstack/react-query';
import { request, sessionQuery } from '@/shared/lib/api';
import { MOCK_CATALOG_ITEMS } from '@/features/catalog/mocks/mockCatalog';
import type { CatalogItem, CatalogResponse } from './catalog.types';
import type { components } from '../../../../../packages/contracts/src/generated/api';
import { canOrderOnWeb, isPreorderSoldOut, matchesSearch } from './catalog.utils';
import { ArrowLeft, MapPin, Store, X } from '@florabot/ui';
import { fetchPublicKiosks } from '../kiosk-location/kiosk-location.api';
import { isValidLatitude, isValidLongitude } from '../kiosk-location/kiosk-location.utils';
import { CatalogAdvancedSearch } from './components/CatalogAdvancedSearch';
import { CatalogEmptyState } from './components/CatalogEmptyState';
import { CatalogGrid } from './components/CatalogGrid';
import { CatalogSearchBar } from './components/CatalogSearchBar';
import { CatalogSidebar } from './components/CatalogSidebar';
import { CatalogToolbar } from './components/CatalogToolbar';
import { ChatNoticeDialog } from './components/ChatNoticeDialog';
import { FlowerRequestPanel } from './components/FlowerRequestPanel';
import { RatingStars } from './components/RatingStars';
import { useCatalogDialog } from './hooks/useCatalogDialog';
import { useCatalogFilters } from './hooks/useCatalogFilters';
import { useCustomerChat } from './hooks/useCustomerChat';
import { loadCatalog } from './catalog.data';
import { getCatalogTagGroups } from './catalog.tags';
import { PREORDER_FILTER_LABEL } from './catalog.constants';
import { PRODUCT_REVIEWS_STALE_TIME, readReviewRating } from './product-reviews.api';

export default function FlowerShop({ storefrontSellerId }: { storefrontSellerId?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const session = useQuery(sessionQuery);

  const searchParams = useSearchParams();
  const [demoEnabled] = useState<boolean>(() => {
    if (storefrontSellerId || typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return params.get('demo') === '1' || params.get('demo') === 'true';
  });

  const dialog = useCatalogDialog();
  const setSelected = dialog.setSelected;

  const { handleOpenChat, openingChatId, chatNotice, setChatNotice } = useCustomerChat(setSelected);

  const catalog = useQuery({
    queryKey: ['web-catalog', 'all-products'],
    enabled: !demoEnabled,
    refetchInterval: 60_000,
    queryFn: () =>
      loadCatalog((page) => request<CatalogResponse>(`/shop/catalog?page=${page}&search=`)),
  });

  // Prefer backend data. Demo data is opt-in via ?demo=1 and never creates real writes.
  const rawItems: CatalogItem[] = useMemo(() => {
    if (demoEnabled) {
      return MOCK_CATALOG_ITEMS.map((item) => ({ ...item, isDemoSample: true }));
    }
    if (!catalog.data) return [];
    return storefrontSellerId
      ? catalog.data.filter((item) => item.sellerId === storefrontSellerId)
      : catalog.data.filter((item) => !isPreorderSoldOut(item));
  }, [catalog.data, demoEnabled, storefrontSellerId]);
  const hasLiveItems = !demoEnabled && rawItems.length > 0;
  const shopProduct = storefrontSellerId ? rawItems[0] : undefined;
  const shopReviews = useQuery({
    queryKey: ['shop-flower-reviews', storefrontSellerId, 1],
    queryFn: () =>
      request<components['schemas']['ShopFlowerReviewPage']>(
        `/shop/sellers/${encodeURIComponent(storefrontSellerId!)}/reviews?page=1`,
      ),
    enabled: Boolean(storefrontSellerId),
    staleTime: PRODUCT_REVIEWS_STALE_TIME,
    refetchOnWindowFocus: false,
  });
  const shopRating = readReviewRating(shopReviews.data?.shopAverage, shopReviews.data?.shopCount);

  const [origin, setOrigin] = useState<GeolocationCoordinates | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState(false);
  const [advancedSearchOpen, setAdvancedSearchOpen] = useState(false);
  const directory = useQuery({
    queryKey: ['public-kiosks'],
    queryFn: fetchPublicKiosks,
    enabled: origin !== null,
    staleTime: 60_000,
  });
  const distances = useMemo(() => {
    const result = new Map<string, number>();
    if (!origin) return result;
    const radians = Math.PI / 180;
    for (const kiosk of directory.data ?? []) {
      if (!isValidLatitude(kiosk.latitude) || !isValidLongitude(kiosk.longitude)) continue;
      const latitudeDelta = (kiosk.latitude - origin.latitude) * radians;
      const longitudeDelta = (kiosk.longitude - origin.longitude) * radians;
      const haversine =
        Math.sin(latitudeDelta / 2) ** 2 +
        Math.cos(kiosk.latitude * radians) *
          Math.cos(origin.latitude * radians) *
          Math.sin(longitudeDelta / 2) ** 2;
      const earthRadiusKm = 6371;
      result.set(kiosk.id, 2 * earthRadiusKm * Math.asin(Math.sqrt(Math.min(1, haversine))));
    }
    return result;
  }, [directory.data, origin]);

  const filters = useCatalogFilters(rawItems, distances);
  const { search, setSearch, draft, setDraft, advancedTags, applyAdvancedTags } = filters;
  const hasKeyword = Boolean(search.trim());
  const replaceUnmatchedKeyword =
    hasKeyword &&
    (demoEnabled || catalog.isSuccess) &&
    !rawItems.some((item) => matchesSearch(item, search));
  const tagGroups = useMemo(() => getCatalogTagGroups(rawItems), [rawItems]);
  const tagLabels = new Map(
    tagGroups.flatMap(({ options }) => options.map(({ id, label }) => [id, label])),
  );
  const page = Math.min(filters.page, Math.max(1, Math.ceil(filters.displayedItems.length / 12)));
  const catalogHref = catalogReturnPath(pathname + '?' + searchParams.toString());
  const shopPath = storefrontSellerId ? shopCatalogPath(storefrontSellerId) : null;
  const reviewsHref =
    shopPath &&
    shopPath +
      '/danh-gia' +
      (catalogHref === shopPath ? '' : '?' + new URLSearchParams({ from: catalogHref }));
  const pageItems = filters.displayedItems.slice((page - 1) * 12, page * 12);

  const locationStatusMessage = useMemo(() => {
    if (locating) return 'Đang xác định vị trí của bạn…';
    if (origin && directory.isPending) return 'Đang tìm khoảng cách tới các kiosk…';
    if (locationError || directory.isError) {
      return 'Chưa lấy được vị trí hoặc tọa độ kiosk. Bạn vẫn có thể chọn hoa và sắp xếp theo giá, tên.';
    }
    if (!origin && filters.sortBy === 'nearest' && !locating && !locationError) {
      return 'Bấm “Xếp hoa gần tôi” và cho phép vị trí để sắp xếp theo khoảng cách.';
    }
    if (origin && directory.isSuccess && filters.sortBy === 'nearest' && distances.size > 0) {
      return 'Ưu tiên các mẫu hoa tại kiosk gần bạn.';
    }
    if (origin && directory.isSuccess && distances.size === 0) {
      return 'Chưa có tọa độ kiosk để tính khoảng cách. Bạn vẫn có thể chọn hoa.';
    }
    return null;
  }, [
    locating,
    origin,
    directory.isPending,
    directory.isError,
    directory.isSuccess,
    locationError,
    filters.sortBy,
    distances.size,
  ]);

  function locate() {
    setLocationError(false);
    if (!navigator.geolocation) {
      setLocationError(true);
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setOrigin(coords);
        setLocating(false);
        filters.setSortBy('nearest');
      },
      () => {
        setLocating(false);
        setLocationError(true);
      },
      { timeout: 10_000, maximumAge: 60_000 },
    );
  }

  // Resume "Nhắn tin với shop" after returning from login
  useEffect(() => {
    if (!session.data || session.data.role !== 'CUSTOMER' || typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    const sellerId = params.get('sellerId');
    const productId = params.get('productId');
    const shopName = params.get('shopName') || 'Shop hoa';
    const name = params.get('name') || 'Sản phẩm đã chọn';

    if (
      action === 'chat' &&
      sellerId &&
      productId &&
      (!storefrontSellerId || storefrontSellerId === sellerId.toLowerCase())
    ) {
      const url = new URL(window.location.href);
      url.searchParams.delete('action');
      url.searchParams.delete('sellerId');
      url.searchParams.delete('productId');
      url.searchParams.delete('shopName');
      url.searchParams.delete('name');
      window.history.replaceState(null, '', url.pathname + (url.search || '') + url.hash);

      const existing = rawItems.find((i) => i.productId === productId && i.sellerId === sellerId);
      const targetItem: CatalogItem = existing || {
        productId,
        sellerId,
        kioskId: '',
        kioskName: '',
        shopName,
        address: '',
        name,
        description: null,
        price: 0,
        photo: null,
        bouquets: [],
      };

      void handleOpenChat(targetItem);
    }
  }, [session.data, rawItems, storefrontSellerId, handleOpenChat]);

  const handleSearchSubmit = (draftText: string) => {
    const keyword = draftText.trim();
    setAdvancedSearchOpen(false);
    if (!keyword) setDraft('');
    if (keyword !== search || filters.page !== 1) setSearch(keyword);
  };

  const handleSearchClear = () => {
    setAdvancedSearchOpen(false);
    setDraft('');
    if (search) {
      setSearch('');
    }
  };

  if (storefrontSellerId && catalog.isSuccess && !shopProduct && shopReviews.isError) {
    return (
      <main id="main" className="flower-shop-page">
        <div className="flower-detail-feedback">
          <h1>Chưa có mẫu hoa công khai</h1>
          <p>Cửa hàng hiện không có sản phẩm để xem trong danh mục FloraBot.</p>
          <Link href="/dat-hoa" className="button button-outline">
            Xem danh mục hoa
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main
      id="main"
      className={storefrontSellerId ? 'flower-shop-page catalog-shop-page' : 'flower-shop-page'}
    >
      {storefrontSellerId && (
        <nav className="catalog-store-breadcrumb" aria-label="Đường dẫn cửa hàng">
          <Link className="flower-detail-back" href="/dat-hoa">
            <ArrowLeft size={16} aria-hidden="true" />
            Danh mục hoa
          </Link>
        </nav>
      )}
      <header
        className={
          storefrontSellerId
            ? 'catalog-header-minimal catalog-store-header'
            : 'catalog-header-minimal'
        }
        aria-labelledby="catalog-hero-title"
      >
        {storefrontSellerId ? (
          <div className="catalog-store-identity">
            <div className="catalog-store-icon" aria-hidden="true">
              <Store size={26} />
            </div>
            <div>
              <h1 id="catalog-hero-title" className="catalog-hero-title">
                {shopReviews.data?.shopName || shopProduct?.shopName || 'Cửa hàng hoa'}
              </h1>
              {(shopProduct || shopReviews.data) && (
                <div className="catalog-store-stats">
                  <span>{filters.totalCards.toLocaleString('vi-VN')} mẫu hoa</span>
                  {reviewsHref && (
                    <Link
                      className="catalog-store-rating catalog-store-rating-link"
                      href={reviewsHref}
                      aria-label={
                        shopRating
                          ? `Xem ${shopRating.count.toLocaleString('vi-VN')} đánh giá của cửa hàng`
                          : 'Xem đánh giá của cửa hàng'
                      }
                    >
                      {shopRating && (
                        <>
                          <RatingStars value={shopRating.average} />
                          <strong>
                            {new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(
                              shopRating.average,
                            )}
                            /5
                          </strong>
                        </>
                      )}
                      <span>
                        {shopRating
                          ? `${shopRating.count.toLocaleString('vi-VN')} đánh giá`
                          : shopReviews.isSuccess
                            ? 'Chưa có đánh giá'
                            : shopReviews.isError
                              ? 'Xem đánh giá'
                              : 'Đang tải đánh giá…'}
                      </span>
                    </Link>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="catalog-header-left">
            <h1 id="catalog-hero-title" className="catalog-hero-title">
              Hoa đặt trước
            </h1>
            <p className="catalog-hero-desc">
              Khám phá hoa đặt trước và những bó hoa có sẵn tại kiosk.
            </p>
          </div>
        )}
        <CatalogSearchBar
          draft={draft}
          setDraft={setDraft}
          onSubmit={handleSearchSubmit}
          onClear={handleSearchClear}
          shopOnly={Boolean(storefrontSellerId)}
        />
      </header>

      <ChatNoticeDialog
        notice={chatNotice}
        onClose={() => setChatNotice(null)}
        onLogin={(returnUrl) =>
          router.push(`/dang-nhap?returnUrl=${encodeURIComponent(returnUrl)}`)
        }
      />

      {/* Selected flower ordering form (preserves existing preorder test flow) */}
      <FlowerRequestPanel
        selected={dialog.selected}
        onClose={() => dialog.setSelected(null)}
        onOpenChat={handleOpenChat}
        openingChatId={openingChatId}
      />

      {/* Mobile Filter Backdrop */}
      {dialog.mobileFiltersOpen && (
        <div
          className="catalog-sheet-backdrop"
          onClick={dialog.closeMobileFilters}
          aria-hidden="true"
        />
      )}

      {/* Main 2-Column Layout: Sidebar Filters (Left) + Content Area (Right) */}
      <div className="catalog-main-layout">
        <CatalogSidebar
          filters={filters}
          mobileFiltersOpen={dialog.mobileFiltersOpen}
          onClose={dialog.closeMobileFilters}
          totalRawItems={filters.totalCards}
          shopOnly={Boolean(storefrontSellerId)}
        />

        <section className="catalog-main-content" aria-label="Danh sách sản phẩm">
          {storefrontSellerId && (
            <h2 className="catalog-store-products-title">Sản phẩm của shop</h2>
          )}
          {
            <CatalogToolbar
              filterToggleRef={dialog.filterToggleRef}
              mobileFiltersOpen={dialog.mobileFiltersOpen}
              onToggleMobileFilters={() => dialog.setMobileFiltersOpen((prev) => !prev)}
              activeFiltersCount={filters.activeFilters.length + advancedTags.length}
              displayedCount={filters.displayedItems.length}
              searchQuery={search}
              ratingStatus={
                filters.ratingsLoading
                  ? 'Đang lọc theo đánh giá…'
                  : filters.ratingsError
                    ? 'Chưa tải được đánh giá'
                    : undefined
              }
              sortBy={filters.sortBy}
              onSortChange={(value) => {
                if (value === 'nearest' && !origin) locate();
                else filters.setSortBy(value);
              }}
              locating={locating}
              onLocate={storefrontSellerId ? undefined : locate}
              advancedSearchOpen={advancedSearchOpen}
              onToggleAdvancedSearch={() => setAdvancedSearchOpen((current) => !current)}
            />
          }

          {locationStatusMessage && (
            <div
              className={`catalog-location-status ${locationError || directory.isError ? 'is-error' : 'is-info'}`}
              role="status"
            >
              <MapPin size={15} aria-hidden="true" />
              <span>{locationStatusMessage}</span>
            </div>
          )}

          <CatalogAdvancedSearch
            key={JSON.stringify([search, advancedTags])}
            groups={tagGroups}
            tags={advancedTags}
            open={advancedSearchOpen}
            onOpenChange={setAdvancedSearchOpen}
            onSearch={(tags) => {
              setAdvancedSearchOpen(false);
              applyAdvancedTags(tags, replaceUnmatchedKeyword);
            }}
          />

          {(advancedTags.length > 0 ||
            filters.preorderOnly ||
            filters.ratingActiveFilters.length > 0 ||
            filters.kioskFilter !== 'all') && (
            <div className="catalog-applied-tags" aria-label="Bộ lọc đang dùng">
              {filters.ratingActiveFilters.map(({ id, label, onClear }) => (
                <button
                  type="button"
                  key={id}
                  className="catalog-active-tag"
                  aria-label={`Bỏ lọc ${label}`}
                  onClick={onClear}
                >
                  {label}
                  <X size={14} aria-hidden="true" />
                </button>
              ))}
              {filters.preorderOnly && (
                <button
                  type="button"
                  className="catalog-active-tag"
                  aria-label="Bỏ lọc còn nhận đặt trước"
                  onClick={() => filters.setPreorderOnly(false)}
                >
                  {PREORDER_FILTER_LABEL}
                  <X size={14} aria-hidden="true" />
                </button>
              )}
              {filters.kioskFilter !== 'all' && (
                <button
                  type="button"
                  className="catalog-active-tag"
                  aria-label={`Bỏ lọc theo tủ ${filters.kioskFilter}`}
                  onClick={() => filters.setKioskFilter('all')}
                >
                  {filters.kioskFilter}
                  <X size={14} aria-hidden="true" />
                </button>
              )}
              {advancedTags.map((tag) => {
                const label = tagLabels.get(tag) ?? tag.slice(tag.indexOf(':') + 1);
                return (
                  <button
                    type="button"
                    key={tag}
                    className="catalog-active-tag"
                    aria-label={`Bỏ tag ${label}`}
                    onClick={() =>
                      applyAdvancedTags(
                        advancedTags.filter((value) => value !== tag),
                        false,
                      )
                    }
                  >
                    {label}
                    <X size={14} aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          )}

          {storefrontSellerId && catalog.isSuccess && rawItems.length === 0 ? (
            <div className="flower-detail-feedback">
              <h2>Chưa có mẫu hoa công khai</h2>
              <Link href="/dat-hoa" className="button button-outline">
                Xem danh mục hoa
              </Link>
            </div>
          ) : (
            <CatalogEmptyState
              isPending={(!demoEnabled && catalog.isPending) || filters.ratingsLoading}
              error={filters.ratingsError ? 'ratings' : catalog.isError ? 'catalog' : null}
              hasItems={filters.displayedItems.length > 0}
              search={search}
              hasActiveFilters={filters.hasActiveFilters}
              onRefetch={() =>
                void (filters.ratingsError ? filters.refetchRatings() : catalog.refetch())
              }
              onResetFilters={filters.resetFilters}
            />
          )}

          {(demoEnabled || !catalog.isPending) &&
            (!catalog.isError || filters.displayedItems.length > 0) &&
            filters.displayedItems.length > 0 && (
              <CatalogGrid
                catalogHref={catalogHref}
                hideShopIdentity={Boolean(storefrontSellerId)}
                items={pageItems}
                distances={
                  filters.sortBy === 'nearest' && directory.isSuccess ? distances : undefined
                }
                page={page}
                hasMore={page * 12 < filters.displayedItems.length}
                isFetching={catalog.isFetching}
                hasLiveItems={hasLiveItems || demoEnabled}
                openingChatId={openingChatId}
                onSelect={(item) => {
                  if (!canOrderOnWeb(item)) return;
                  dialog.setSelected(item);
                }}
                onOpenChat={(item) => void handleOpenChat(item)}
                onPrevPage={() => filters.setPage(page - 1)}
                onNextPage={() => filters.setPage(page + 1)}
              />
            )}
        </section>
      </div>
    </main>
  );
}
