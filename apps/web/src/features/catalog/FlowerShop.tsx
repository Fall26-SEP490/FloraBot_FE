import { useEffect, useMemo, useState } from 'react';
import './styles/catalog.css';
import { useRouter, useSearchParams } from 'next/navigation';
import { catalogReturnPath } from './catalog.navigation';
import { useQuery } from '@tanstack/react-query';
import { request, sessionQuery } from '@/shared/lib/api';
import { MOCK_CATALOG_ITEMS } from '@/features/catalog/mocks/mockCatalog';
import type { CatalogItem, CatalogResponse } from './catalog.types';
import { canOrderOnWeb } from './catalog.utils';
import { MapPin } from '@florabot/ui';
import { fetchPublicKiosks } from '../kiosk-location/kiosk-location.api';
import { isValidLatitude, isValidLongitude } from '../kiosk-location/kiosk-location.utils';
import { CatalogEmptyState } from './components/CatalogEmptyState';
import { CatalogGrid } from './components/CatalogGrid';
import { CatalogSearchBar } from './components/CatalogSearchBar';
import { CatalogSidebar } from './components/CatalogSidebar';
import { CatalogToolbar } from './components/CatalogToolbar';
import { ChatNoticeDialog } from './components/ChatNoticeDialog';
import { FlowerRequestPanel } from './components/FlowerRequestPanel';
import { useCatalogDialog } from './hooks/useCatalogDialog';
import { useCatalogFilters } from './hooks/useCatalogFilters';
import { useCustomerChat } from './hooks/useCustomerChat';
import { loadCatalog } from './catalog.data';

export default function FlowerShop() {
  const router = useRouter();
  const session = useQuery(sessionQuery);

  const searchParams = useSearchParams();
  const [demoEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return params.get('demo') === '1' || params.get('demo') === 'true';
  });

  const dialog = useCatalogDialog();
  const setSelected = dialog.setSelected;

  const { handleOpenChat, openingChatId, chatNotice, setChatNotice } = useCustomerChat(setSelected);

  const catalog = useQuery({
    queryKey: ['web-catalog', 'available-preorders'],
    enabled: !demoEnabled,
    refetchInterval: 60_000,
    queryFn: () =>
      loadCatalog((page) =>
        request<CatalogResponse>(`/shop/catalog?page=${page}&search=&availablePreorderOnly=true`),
      ),
  });

  // Prefer backend data. Demo data is opt-in via ?demo=1 and never creates real writes.
  const hasLiveItems = !demoEnabled && (catalog.data?.length ?? 0) > 0;
  const rawItems: CatalogItem[] = useMemo(() => {
    if (demoEnabled) {
      return MOCK_CATALOG_ITEMS.map((item) => ({ ...item, isDemoSample: true }));
    }
    return catalog.data ?? [];
  }, [catalog.data, demoEnabled]);

  const [origin, setOrigin] = useState<GeolocationCoordinates | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState(false);
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
      // Haversine's central-angle score preserves distance order without rounding.
      result.set(
        kiosk.id,
        Math.sin(latitudeDelta / 2) ** 2 +
          Math.cos(kiosk.latitude * radians) *
            Math.cos(origin.latitude * radians) *
            Math.sin(longitudeDelta / 2) ** 2,
      );
    }
    return result;
  }, [directory.data, origin]);

  const filters = useCatalogFilters(rawItems, distances);
  const { search, setSearch, draft, setDraft } = filters;
  const page = Math.min(filters.page, Math.max(1, Math.ceil(filters.displayedItems.length / 12)));
  const catalogHref = catalogReturnPath('/dat-hoa?' + searchParams.toString());
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
      return 'Ưu tiên hoa tại các kiosk gần bạn còn chỗ PREORDER.';
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

    if (action === 'chat' && sellerId && productId) {
      const url = new URL(window.location.href);
      url.searchParams.delete('action');
      url.searchParams.delete('sellerId');
      url.searchParams.delete('productId');
      url.searchParams.delete('shopName');
      url.searchParams.delete('name');
      window.history.replaceState(null, '', url.pathname + (url.search || '') + url.hash);

      const existing = rawItems.find((i) => i.productId === productId);
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
  }, [session.data, rawItems, handleOpenChat]);

  const handleSearchSubmit = (draftText: string) => {
    setSearch(draftText.trim());
  };

  const handleSearchClear = () => {
    setDraft('');
    if (search) {
      setSearch('');
    }
  };

  return (
    <main id="main" className="flower-shop-page">
      <header className="catalog-header-minimal" aria-labelledby="catalog-hero-title">
        <div className="catalog-header-left">
          <h1 id="catalog-hero-title" className="catalog-hero-title">
            Sản phẩm hoa
          </h1>
          <p className="catalog-hero-desc">
            Khám phá hoa đặt trước và những bó hoa có sẵn tại kiosk.
          </p>
        </div>
        <CatalogSearchBar
          draft={draft}
          setDraft={setDraft}
          onSubmit={handleSearchSubmit}
          onClear={handleSearchClear}
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
          totalRawItems={rawItems.length}
        />

        <section className="catalog-main-content" aria-label="Danh sách sản phẩm">
          {(filters.displayedItems.length > 0 || filters.hasActiveFilters) && (
            <CatalogToolbar
              filterToggleRef={dialog.filterToggleRef}
              mobileFiltersOpen={dialog.mobileFiltersOpen}
              onToggleMobileFilters={() => dialog.setMobileFiltersOpen((prev) => !prev)}
              activeFiltersCount={filters.activeFilters.length}
              displayedCount={filters.displayedItems.length}
              searchQuery={search}
              sortBy={filters.sortBy}
              onSortChange={(value) => {
                if (value === 'nearest' && !origin) locate();
                else filters.setSortBy(value);
              }}
              locating={locating}
              onLocate={locate}
            />
          )}

          {locationStatusMessage && (
            <div
              className={`catalog-location-status ${locationError || directory.isError ? 'is-error' : 'is-info'}`}
              role="status"
            >
              <MapPin size={15} aria-hidden="true" />
              <span>{locationStatusMessage}</span>
            </div>
          )}

          <CatalogEmptyState
            isPending={!demoEnabled && catalog.isPending}
            isError={catalog.isError}
            hasItems={filters.displayedItems.length > 0}
            search={search}
            hasActiveFilters={filters.hasActiveFilters}
            onRefetch={() => void catalog.refetch()}
            onResetFilters={filters.resetFilters}
          />

          {(demoEnabled || !catalog.isPending) &&
            (!catalog.isError || filters.displayedItems.length > 0) &&
            filters.displayedItems.length > 0 && (
              <CatalogGrid
                catalogHref={catalogHref}
                items={pageItems}
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
