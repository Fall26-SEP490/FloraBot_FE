import { useCallback, useEffect, useMemo, useState } from 'react';
import './styles/catalog.css';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { request, sessionQuery } from '@/shared/lib/api';
import { formatChatError, openCustomerChat } from '@/features/chat/api';
import { MOCK_CATALOG_ITEMS } from '@/features/catalog/mocks/mockCatalog';
import type { CatalogItem, CatalogResponse } from './catalog.types';
import { canOrderOnWeb } from './catalog.utils';
import { CatalogEmptyState } from './components/CatalogEmptyState';
import { CatalogGrid } from './components/CatalogGrid';
import { CatalogSearchBar } from './components/CatalogSearchBar';
import { CatalogSidebar } from './components/CatalogSidebar';
import { CatalogToolbar } from './components/CatalogToolbar';
import { FlowerRequestPanel } from './components/FlowerRequestPanel';
import { useCatalogDialog } from './hooks/useCatalogDialog';
import { useCatalogFilters } from './hooks/useCatalogFilters';

export default function FlowerShop() {
  const router = useRouter();
  const session = useQuery(sessionQuery);

  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState('');
  const [page, setPage] = useState(1);
  const [openingChatId, setOpeningChatId] = useState<string | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);

  const [demoEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return params.get('demo') === '1' || params.get('demo') === 'true';
  });

  const dialog = useCatalogDialog();

  const handleOpenChat = useCallback(
    async (item: CatalogItem) => {
      if (item.isDemoSample) {
        setChatError(
          'Mẫu minh họa chưa gắn với shop thật. Hãy chọn sản phẩm từ danh mục API để nhắn tin.',
        );
        return;
      }
      if (!session.data) {
        const returnUrl = `/dat-hoa?action=chat&sellerId=${encodeURIComponent(item.sellerId)}&productId=${encodeURIComponent(item.productId)}&shopName=${encodeURIComponent(item.shopName)}&name=${encodeURIComponent(item.name)}`;
        router.push(`/dang-nhap?returnUrl=${encodeURIComponent(returnUrl)}`);
        return;
      }
      if (session.data.role !== 'CUSTOMER') {
        setChatError('Chỉ tài khoản khách hàng thành viên mới có thể nhắn tin với shop.');
        return;
      }
      setOpeningChatId(item.productId);
      setChatError(null);
      try {
        const chat = await openCustomerChat({
          sellerId: item.sellerId,
          productId: item.productId,
        });
        if (typeof window !== 'undefined') {
          try {
            sessionStorage.setItem(
              'florabot_opened_chat',
              JSON.stringify({
                id: chat.id,
                otherPartyName: item.shopName,
                productContext: item.name,
                createdAt: new Date().toISOString(),
              }),
            );
          } catch {
            // ignore storage error
          }
        }
        router.push(`/tai-khoan?chat=${encodeURIComponent(chat.id)}#member-chats`);
      } catch (err) {
        setChatError(formatChatError(err));
      } finally {
        setOpeningChatId(null);
      }
    },
    [session.data, router],
  );

  const catalog = useQuery({
    queryKey: ['web-catalog', search, page],
    queryFn: () =>
      request<CatalogResponse>(`/shop/catalog?page=${page}&search=${encodeURIComponent(search)}`),
  });

  // Prefer backend data. Demo data is opt-in via ?demo=1 and never creates real writes.
  const hasLiveItems = (catalog.data?.items?.length ?? 0) > 0;
  const rawItems: CatalogItem[] = useMemo(() => {
    if (demoEnabled) {
      return MOCK_CATALOG_ITEMS.map((item) => ({ ...item, isDemoSample: true }));
    }
    return catalog.data?.items ?? [];
  }, [catalog.data?.items, demoEnabled]);

  // Hook owns filters state and derived items
  const filters = useCatalogFilters(rawItems, {
    search,
    setSearch,
    draft,
    setDraft,
  });

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

      const timer = setTimeout(() => {
        void handleOpenChat(targetItem);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [session.data, rawItems, handleOpenChat]);

  const handleSearchSubmit = (draftText: string) => {
    setPage(1);
    setSearch(draftText.trim());
  };

  const handleSearchClear = () => {
    setDraft('');
    if (search) {
      setPage(1);
      setSearch('');
    }
  };

  return (
    <main id="main" className="flower-shop-page">
      <header className="catalog-header-minimal" aria-labelledby="catalog-hero-title">
        <div className="catalog-header-left">
          <h1 id="catalog-hero-title" className="catalog-hero-title">
            Chọn hoa cho một dịp thật riêng.
          </h1>
        </div>
        <p className="catalog-hero-desc">Chọn mẫu hoa yêu thích và đặt trước để nhận tại kiosk.</p>
      </header>

      {chatError && (
        <p role="alert" className="error" style={{ marginBlock: '1rem' }}>
          {chatError}
        </p>
      )}

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
          <CatalogSearchBar
            draft={draft}
            setDraft={setDraft}
            onSubmit={handleSearchSubmit}
            onClear={handleSearchClear}
          />

          {(filters.displayedItems.length > 0 || filters.hasActiveFilters) && (
            <CatalogToolbar
              filterToggleRef={dialog.filterToggleRef}
              mobileFiltersOpen={dialog.mobileFiltersOpen}
              onToggleMobileFilters={() => dialog.setMobileFiltersOpen((prev) => !prev)}
              activeFiltersCount={filters.activeFilters.length}
              displayedCount={filters.displayedItems.length}
              searchQuery={search}
              sortBy={filters.sortBy}
              onSortChange={filters.setSortBy}
            />
          )}

          <CatalogEmptyState
            isPending={catalog.isPending}
            isError={catalog.isError}
            hasItems={filters.displayedItems.length > 0}
            search={search}
            hasActiveFilters={filters.hasActiveFilters}
            onRefetch={() => void catalog.refetch()}
            onResetFilters={filters.resetFilters}
          />

          {!catalog.isPending &&
            (!catalog.isError || filters.displayedItems.length > 0) &&
            filters.displayedItems.length > 0 && (
              <CatalogGrid
                items={filters.displayedItems}
                page={page}
                hasMore={Boolean(catalog.data?.hasMore)}
                isFetching={catalog.isFetching}
                hasLiveItems={hasLiveItems}
                openingChatId={openingChatId}
                onSelect={(item) => {
                  if (!canOrderOnWeb(item)) return;
                  dialog.setSelected(item);
                }}
                onOpenChat={(item) => void handleOpenChat(item)}
                onPrevPage={() => setPage((value) => value - 1)}
                onNextPage={() => setPage((value) => value + 1)}
              />
            )}
        </section>
      </div>
    </main>
  );
}
