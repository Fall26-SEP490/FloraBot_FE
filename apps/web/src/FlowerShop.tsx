import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  Button,
  Check,
  Flower2,
  LayoutGrid,
  MapPin,
  MessageSquare,
  Search,
  SlidersHorizontal,
  Store,
  X,
} from '@florabot/ui';
import { ApiError, queryClient, request, sessionQuery } from './api';
import { formatChatError, openCustomerChat } from './chat/api';
import { MOCK_CATALOG_ITEMS } from './mockCatalog';

type Item = {
  productId: string;
  sellerId: string;
  shopName: string;
  name: string;
  description: string | null;
  price: number;
  kioskId: string;
  kioskName: string;
  address: string;
  photo: string | null;
  bouquets: string[];
  isDemoSample?: boolean;
};
type Catalog = { items: Item[]; page: number; hasMore: boolean };
function RequestForm({ item }: { item: Item }) {
  const session = useQuery(sessionQuery);
  const [kind, setKind] = useState<'CUSTOM' | 'STOCK'>('CUSTOM');
  const [pickup, setPickup] = useState('');
  const [instructions, setInstructions] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  // Keep the same request identity and payload after a network timeout.
  const pending = useRef<object | null>(null);
  const sending = useRef(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (sending.current || !confirmed) return;
    sending.current = true;
    setBusy(true);
    if (item.isDemoSample && (!item.bouquets || item.bouquets.length === 0)) {
      setError(
        'Sản phẩm mẫu này chỉ dùng để tham khảo trong catalog demo. Vui lòng nhắn tin với shop để yêu cầu cắm mẫu này.',
      );
      sending.current = false;
      setBusy(false);
      setUncertain(false);
      return;
    }
    pending.current ??= {
      id: crypto.randomUUID(),
      kind,
      productId: item.productId,
      kioskId: item.kioskId,
      bouquetId: kind === 'STOCK' ? item.bouquets[0] : null,
      pickupAt: kind === 'CUSTOM' ? new Date(pickup).toISOString() : new Date().toISOString(),
      instructions,
    };
    try {
      await request('/member/preorders', pending.current);
      setDone(true);
      await queryClient.invalidateQueries({ queryKey: ['web-orders'] });
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : 'Chưa xác nhận được kết quả. Kiểm tra tài khoản hoặc gửi lại cùng yêu cầu.',
      );
      if (cause instanceof ApiError && cause.status >= 400 && cause.status < 500) {
        pending.current = null;
        setUncertain(false);
      }
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  if (done)
    return (
      <div role="status">
        <h3>Đã nhận yêu cầu của bạn</h3>
        <p>
          {kind === 'CUSTOM'
            ? 'Shop sẽ báo giá và xác nhận lịch nhận trong tài khoản của bạn.'
            : 'Bó hoa đang được giữ chờ thanh toán. Mở đơn ngay để xem thời hạn và thanh toán.'}
        </p>
        <Link href="/tai-khoan">Theo dõi và thanh toán trong tài khoản</Link>
      </div>
    );
  if (!session.data)
    return (
      <p>
        <Link href="/dang-nhap">Đăng nhập</Link> hoặc <Link href="/dang-ky">tạo tài khoản</Link> để
        đặt hoa và theo dõi đơn.
      </p>
    );
  if (!['CUSTOMER', 'SELLER'].includes(session.data.role))
    return <p>Hãy dùng tài khoản thành viên để mua hoa. Tài khoản hiện tại dành cho vận hành.</p>;
  return (
    <form onSubmit={(event) => void submit(event)}>
      <fieldset disabled={busy || uncertain}>
        <legend>Bạn muốn nhận bó hoa nào?</legend>
        <label className="payout-checkbox">
          <input
            type="radio"
            name={`kind-${item.productId}`}
            checked={kind === 'CUSTOM'}
            onChange={() => {
              setKind('CUSTOM');
              setConfirmed(false);
            }}
          />
          Đặt mẫu riêng, shop chuẩn bị theo yêu cầu
        </label>
        <label className="payout-checkbox">
          <input
            type="radio"
            name={`kind-${item.productId}`}
            checked={kind === 'STOCK'}
            disabled={!item.bouquets.length}
            onChange={() => {
              setKind('STOCK');
              setConfirmed(false);
            }}
          />
          Mua hoa có sẵn tại tủ ({item.bouquets.length} bó)
        </label>
        {kind === 'CUSTOM' ? (
          <>
            <label htmlFor={`pickup-${item.productId}`}>Thời gian mong muốn nhận hoa</label>
            <input
              id={`pickup-${item.productId}`}
              type="datetime-local"
              required
              value={pickup}
              onChange={(event) => setPickup(event.target.value)}
            />
            <p className="quiet">
              Chọn từ 2 giờ đến 30 ngày tới. Lịch chính thức được shop xác nhận cùng báo giá.
            </p>
            <label htmlFor={`brief-${item.productId}`}>
              Dịp tặng, màu hoa, ngân sách và lời nhắn
            </label>
            <textarea
              id={`brief-${item.productId}`}
              minLength={10}
              maxLength={2000}
              required
              value={instructions}
              onChange={(event) => setInstructions(event.target.value)}
            />
            <p>
              Giá trên mẫu là giá tham khảo. Bạn chỉ thanh toán sau khi đồng ý báo giá và lịch nhận
              của shop.
            </p>
          </>
        ) : (
          <p>
            Bó có sẵn được giữ trong thời gian thanh toán. Sau khi thanh toán, đến tủ nhận trong
            thời hạn ghi trên đơn.
          </p>
        )}
        <p>
          <strong>Tủ nhận:</strong> {item.kioskName} — {item.address}
        </p>
        <label className="payout-checkbox">
          <input
            type="checkbox"
            required
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
          />
          Tôi đã kiểm tra tủ nhận và thông tin yêu cầu.
        </label>
      </fieldset>
      <p role="alert" className="error">
        {error}
      </p>
      <Button type="submit" disabled={busy || !confirmed}>
        {busy
          ? 'Đang gửi…'
          : uncertain
            ? 'Gửi lại cùng yêu cầu'
            : kind === 'CUSTOM'
              ? 'Gửi yêu cầu để shop báo giá'
              : 'Giữ bó hoa và tiếp tục thanh toán'}
      </Button>
      {uncertain && !busy && (
        <p>
          <Link href="/tai-khoan">Kiểm tra yêu cầu trong tài khoản</Link>
        </p>
      )}
    </form>
  );
}
export default function FlowerShop() {
  const router = useRouter();
  const session = useQuery(sessionQuery);
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Item | null>(null);
  const [detailModalItem, setDetailModalItem] = useState<Item | null>(null);
  const [openingChatId, setOpeningChatId] = useState<string | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);

  // Filters state
  const [priceFilter, setPriceFilter] = useState<string>('all');
  const [occasionFilter, setOccasionFilter] = useState<string>('all');
  const [shopFilter, setShopFilter] = useState<string>('all');
  const [kioskFilter, setKioskFilter] = useState<string>('all');
  const [availabilityFilter, setAvailabilityFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('default');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [demoEnabled, setDemoEnabled] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('demo') === '1' || params.get('demo') === 'true';
    }
    return false;
  });

  const catalog = useQuery({
    queryKey: ['web-catalog', search, page],
    queryFn: () =>
      request<Catalog>(`/shop/catalog?page=${page}&search=${encodeURIComponent(search)}`),
  });

  const modalTriggerRef = useRef<HTMLElement | null>(null);
  const modalCloseBtnRef = useRef<HTMLButtonElement | null>(null);
  const modalContentRef = useRef<HTMLDivElement | null>(null);

  const openDetailModal = (item: Item, triggerEl: HTMLElement) => {
    modalTriggerRef.current = triggerEl;
    setDetailModalItem(item);
  };

  const closeDetailModal = () => {
    setDetailModalItem(null);
    modalTriggerRef.current?.focus();
  };

  useEffect(() => {
    if (!detailModalItem) return;
    modalCloseBtnRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeDetailModal();
        return;
      }
      if (e.key === 'Tab' && modalContentRef.current) {
        const focusable = modalContentRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [detailModalItem]);

  const handleOpenChat = useCallback(
    async (item: Item) => {
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

  // Base items: prefer real API items if available; otherwise use MOCK_CATALOG_ITEMS if demoEnabled
  const hasLiveItems = (catalog.data?.items?.length ?? 0) > 0;
  const rawItems: Item[] = useMemo(() => {
    return (catalog.data?.items?.length ?? 0) > 0
      ? (catalog.data?.items ?? [])
      : demoEnabled
        ? MOCK_CATALOG_ITEMS
        : [];
  }, [catalog.data?.items, demoEnabled]);

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
      const targetItem: Item = existing || {
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

  // Client-side filtering
  const filteredItems = rawItems.filter((item) => {
    // Search match (for demo data or client refinement)
    if (search.trim()) {
      const query = search.toLowerCase();
      const match =
        item.name.toLowerCase().includes(query) ||
        item.shopName.toLowerCase().includes(query) ||
        item.kioskName.toLowerCase().includes(query) ||
        item.address.toLowerCase().includes(query) ||
        (item.description?.toLowerCase().includes(query) ?? false);
      if (!match) return false;
    }

    // Price filter
    if (priceFilter === 'under300' && item.price >= 300000) return false;
    if (priceFilter === '300to600' && (item.price < 300000 || item.price > 600000)) return false;
    if (priceFilter === '600to1000' && (item.price < 600000 || item.price > 1000000)) return false;
    if (priceFilter === 'over1000' && item.price <= 1000000) return false;

    // Occasion / Tag filter
    if (occasionFilter !== 'all') {
      const mockItem = item as { occasion?: string; tags?: string[] };
      const matchesOccasion =
        mockItem.occasion === occasionFilter ||
        mockItem.tags?.includes(occasionFilter) ||
        item.description?.toLowerCase().includes(occasionFilter.toLowerCase());
      if (!matchesOccasion) return false;
    }

    // Shop filter
    if (shopFilter !== 'all' && item.shopName !== shopFilter) return false;

    // Kiosk filter
    if (kioskFilter !== 'all' && item.kioskName !== kioskFilter) return false;

    // Availability filter
    if (availabilityFilter === 'stock' && (!item.bouquets || item.bouquets.length === 0))
      return false;
    if (availabilityFilter === 'custom' && item.bouquets && item.bouquets.length > 0) return false;

    return true;
  });

  // Client-side sorting
  const displayedItems = [...filteredItems].sort((a, b) => {
    if (sortBy === 'price-asc') return a.price - b.price;
    if (sortBy === 'price-desc') return b.price - a.price;
    if (sortBy === 'name-asc') return a.name.localeCompare(b.name, 'vi');
    return 0;
  });

  // Occasions list
  const occasionList = [
    'Sinh nhật',
    'Khai trương',
    'Tình yêu',
    'Tốt nghiệp',
    'Cảm ơn',
    'Kỷ niệm',
    'Chúc mừng',
  ];

  // Aggregated counts for filter checkboxes
  const occasionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    rawItems.forEach((item) => {
      const occ = (item as { occasion?: string }).occasion;
      if (occ) {
        counts[occ] = (counts[occ] || 0) + 1;
      }
    });
    return counts;
  }, [rawItems]);

  const priceCounts = useMemo(() => {
    let under300 = 0;
    let range300to600 = 0;
    let range600to1000 = 0;
    let over1000 = 0;
    rawItems.forEach((item) => {
      if (item.price < 300000) under300++;
      else if (item.price <= 600000) range300to600++;
      else if (item.price <= 1000000) range600to1000++;
      else over1000++;
    });
    return { under300, range300to600, range600to1000, over1000 };
  }, [rawItems]);

  const availabilityCounts = useMemo(() => {
    let stock = 0;
    let custom = 0;
    rawItems.forEach((item) => {
      if (item.bouquets && item.bouquets.length > 0) stock++;
      else custom++;
    });
    return { stock, custom };
  }, [rawItems]);

  const shopCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    rawItems.forEach((item) => {
      if (item.shopName) counts[item.shopName] = (counts[item.shopName] || 0) + 1;
    });
    return counts;
  }, [rawItems]);

  const kioskCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    rawItems.forEach((item) => {
      if (item.kioskName) counts[item.kioskName] = (counts[item.kioskName] || 0) + 1;
    });
    return counts;
  }, [rawItems]);

  // Unique options for filter lists
  const availableShops = Array.from(new Set(rawItems.map((i) => i.shopName))).filter(Boolean);
  const availableKiosks = Array.from(new Set(rawItems.map((i) => i.kioskName))).filter(Boolean);

  // Active filters list
  const activeFilters = useMemo(() => {
    const list: { id: string; label: string; onClear: () => void }[] = [];
    if (search.trim()) {
      list.push({
        id: 'search',
        label: `"${search}"`,
        onClear: () => {
          setSearch('');
          setDraft('');
        },
      });
    }
    if (occasionFilter !== 'all') {
      list.push({
        id: 'occasion',
        label: occasionFilter,
        onClear: () => setOccasionFilter('all'),
      });
    }
    if (priceFilter !== 'all') {
      const labels: Record<string, string> = {
        under300: '< 300.000 đ',
        '300to600': '300k – 600k',
        '600to1000': '600k – 1tr',
        over1000: '> 1.000.000 đ',
      };
      list.push({
        id: 'price',
        label: labels[priceFilter] || priceFilter,
        onClear: () => setPriceFilter('all'),
      });
    }
    if (availabilityFilter !== 'all') {
      list.push({
        id: 'availability',
        label: availabilityFilter === 'stock' ? 'Có sẵn tại tủ' : 'Đặt làm riêng',
        onClear: () => setAvailabilityFilter('all'),
      });
    }
    if (shopFilter !== 'all') {
      list.push({
        id: 'shop',
        label: shopFilter,
        onClear: () => setShopFilter('all'),
      });
    }
    if (kioskFilter !== 'all') {
      list.push({
        id: 'kiosk',
        label: kioskFilter,
        onClear: () => setKioskFilter('all'),
      });
    }
    return list;
  }, [search, occasionFilter, priceFilter, availabilityFilter, shopFilter, kioskFilter]);

  function resetFilters() {
    setDraft('');
    setSearch('');
    setPriceFilter('all');
    setOccasionFilter('all');
    setShopFilter('all');
    setKioskFilter('all');
    setAvailabilityFilter('all');
    setSortBy('default');
  }

  function getOccasionBadgeClass(occasion?: string) {
    if (!occasion) return '';
    const map: Record<string, string> = {
      'Sinh nhật': 'occasion-sinhnhat',
      'Tốt nghiệp': 'occasion-totnghiep',
      'Tình yêu': 'occasion-tinhyeu',
      'Khai trương': 'occasion-khaitruong',
      'Cảm ơn': 'occasion-camon',
      'Kỷ niệm': 'occasion-kyniem',
      'Chúc mừng': 'occasion-chucmung',
    };
    return map[occasion] || '';
  }

  return (
    <>
      <main id="main" className="flower-shop-page">
        {/* Streamlined Minimal Header */}
        <header className="catalog-header-minimal" aria-labelledby="catalog-hero-title">
          <div className="catalog-header-badge">
            <Flower2 size={16} aria-hidden="true" />
            <span>Danh mục hoa tươi & thiết kế riêng</span>
          </div>
          <h1 id="catalog-hero-title" className="catalog-hero-title">
            Chọn hoa cho một dịp thật riêng.
          </h1>
          <p className="catalog-hero-desc">
            Đặt mẫu bạn thích để shop chuẩn bị gửi đến tủ gần bạn, hoặc chọn bó có sẵn để nhận ngay.
          </p>
        </header>

        {/* Demo Mode Toggle Banner (Subtle & Compact) */}
        {!hasLiveItems && (
          <aside className="catalog-demo-banner" aria-label="Trạng thái dữ liệu">
            <span>
              {demoEnabled
                ? 'Đang hiển thị 12 sản phẩm mẫu phong phú từ các shop để bạn dễ dàng trải nghiệm catalog.'
                : 'Đang kết nối API trực tiếp từ backend (chưa có sản phẩm trên database).'}
            </span>
            <button
              type="button"
              className="catalog-demo-btn"
              onClick={() => setDemoEnabled((prev) => !prev)}
            >
              {demoEnabled ? 'Tắt dữ liệu mẫu' : 'Bật dữ liệu mẫu'}
            </button>
          </aside>
        )}

        {chatError && (
          <p role="alert" className="error" style={{ marginBlock: '1rem' }}>
            {chatError}
          </p>
        )}

        {/* Selected flower ordering form (preserves existing preorder test flow) */}
        {selected && (
          <section
            className="flower-request"
            aria-labelledby="selected-flower"
            style={{
              background: '#f7faf5',
              border: '2px solid #174b35',
              borderRadius: '16px',
              padding: '1.5rem',
              marginBottom: '2rem',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                flexWrap: 'wrap',
                gap: '0.5rem',
              }}
            >
              <h2 id="selected-flower" style={{ color: '#113421', margin: 0 }}>
                Đặt {selected.name}
              </h2>
              <Button variant="outline" onClick={() => setSelected(null)}>
                Đóng mẫu đang chọn
              </Button>
            </div>
            <p style={{ color: '#385540', marginTop: '0.25rem' }}>
              {selected.shopName} · {selected.kioskName}
            </p>
            <RequestForm key={`${selected.productId}-${selected.kioskId}`} item={selected} />
            <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap', marginTop: '1rem' }}>
              <Button
                variant="outline"
                type="button"
                className="chat-open-btn"
                disabled={openingChatId === selected.productId}
                onClick={() => void handleOpenChat(selected)}
              >
                <MessageSquare size={16} aria-hidden="true" />
                {openingChatId === selected.productId ? 'Đang mở chat…' : 'Nhắn tin với shop'}
              </Button>
            </div>
          </section>
        )}

        {/* Mobile Filter Toggle Bar */}
        <div className="catalog-mobile-filter-bar">
          <button
            type="button"
            className="catalog-mobile-filter-btn"
            onClick={() => setMobileFiltersOpen((prev) => !prev)}
            aria-expanded={mobileFiltersOpen}
          >
            <SlidersHorizontal size={16} aria-hidden="true" />
            <span>Bộ lọc {activeFilters.length > 0 && `(${activeFilters.length})`}</span>
          </button>
          {activeFilters.length > 0 && (
            <button type="button" className="catalog-mobile-clear-btn" onClick={resetFilters}>
              Xóa tất cả
            </button>
          )}
        </div>

        {/* Main 2-Column Layout: Sidebar Filters (Left) + Content Area (Right) */}
        <div className="catalog-main-layout">
          {/* LEFT SIDEBAR: FILTERS */}
          <aside
            className={`catalog-sidebar ${mobileFiltersOpen ? 'is-mobile-open' : ''}`}
            aria-label="Bộ lọc sản phẩm"
          >
            <div className="catalog-sidebar-header">
              <div className="catalog-sidebar-title">
                <SlidersHorizontal size={18} aria-hidden="true" />
                <span>Bộ lọc</span>
              </div>
              <Button
                type="button"
                variant="outline"
                className="catalog-sidebar-reset-btn"
                onClick={resetFilters}
              >
                Đặt lại bộ lọc
              </Button>
            </div>

            {/* Active Filters Section */}
            {activeFilters.length > 0 && (
              <div className="catalog-active-filters-wrap">
                <div className="catalog-active-filters-head">
                  <span className="catalog-active-filters-label">Đang lọc theo:</span>
                </div>
                <div className="catalog-active-tags-list">
                  {activeFilters.map((af) => (
                    <button
                      key={af.id}
                      type="button"
                      className="catalog-active-tag"
                      onClick={af.onClear}
                      title={`Bỏ lọc ${af.label}`}
                    >
                      <span>{af.label}</span>
                      <X size={12} aria-hidden="true" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Filter Group: Dịp tặng */}
            <div className="catalog-filter-group">
              <h3 className="catalog-filter-title">Dịp tặng</h3>
              <ul className="catalog-filter-list">
                <li>
                  <button
                    type="button"
                    className={`catalog-filter-option ${occasionFilter === 'all' ? 'is-active' : ''}`}
                    onClick={() => setOccasionFilter('all')}
                  >
                    <span className="catalog-option-checkbox">
                      {occasionFilter === 'all' && <Check size={12} strokeWidth={3} />}
                    </span>
                    <span className="catalog-option-text">Tất cả dịp</span>
                    <span className="catalog-option-count">({rawItems.length})</span>
                  </button>
                </li>
                {occasionList.map((occ) => {
                  const count = occasionCounts[occ] || 0;
                  if (count === 0 && !rawItems.length) return null;
                  const isSelected = occasionFilter === occ;
                  return (
                    <li key={occ}>
                      <button
                        type="button"
                        className={`catalog-filter-option ${isSelected ? 'is-active' : ''}`}
                        onClick={() => setOccasionFilter(isSelected ? 'all' : occ)}
                      >
                        <span className="catalog-option-checkbox">
                          {isSelected && <Check size={12} strokeWidth={3} />}
                        </span>
                        <span className="catalog-option-text">{occ}</span>
                        <span className="catalog-option-count">({count})</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Filter Group: Khoảng giá */}
            <div className="catalog-filter-group">
              <h3 className="catalog-filter-title">Khoảng giá</h3>
              <ul className="catalog-filter-list">
                {[
                  { id: 'all', label: 'Tất cả mức giá', count: rawItems.length },
                  { id: 'under300', label: 'Dưới 300.000 đ', count: priceCounts.under300 },
                  {
                    id: '300to600',
                    label: '300.000 đ – 600.000 đ',
                    count: priceCounts.range300to600,
                  },
                  {
                    id: '600to1000',
                    label: '600.000 đ – 1.000.000 đ',
                    count: priceCounts.range600to1000,
                  },
                  { id: 'over1000', label: 'Trên 1.000.000 đ', count: priceCounts.over1000 },
                ].map((tier) => {
                  const isSelected = priceFilter === tier.id;
                  return (
                    <li key={tier.id}>
                      <button
                        type="button"
                        className={`catalog-filter-option ${isSelected ? 'is-active' : ''}`}
                        onClick={() =>
                          setPriceFilter(isSelected && tier.id !== 'all' ? 'all' : tier.id)
                        }
                      >
                        <span className="catalog-option-checkbox">
                          {isSelected && <Check size={12} strokeWidth={3} />}
                        </span>
                        <span className="catalog-option-text">{tier.label}</span>
                        <span className="catalog-option-count">({tier.count})</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Filter Group: Tình trạng hoa */}
            <div className="catalog-filter-group">
              <h3 className="catalog-filter-title">Tình trạng hoa</h3>
              <ul className="catalog-filter-list">
                {[
                  { id: 'all', label: 'Tất cả tình trạng', count: rawItems.length },
                  { id: 'stock', label: 'Có sẵn tại tủ kiosk', count: availabilityCounts.stock },
                  { id: 'custom', label: 'Đặt làm riêng', count: availabilityCounts.custom },
                ].map((avail) => {
                  const isSelected = availabilityFilter === avail.id;
                  return (
                    <li key={avail.id}>
                      <button
                        type="button"
                        className={`catalog-filter-option ${isSelected ? 'is-active' : ''}`}
                        onClick={() =>
                          setAvailabilityFilter(isSelected && avail.id !== 'all' ? 'all' : avail.id)
                        }
                      >
                        <span className="catalog-option-checkbox">
                          {isSelected && <Check size={12} strokeWidth={3} />}
                        </span>
                        <span className="catalog-option-text">{avail.label}</span>
                        <span className="catalog-option-count">({avail.count})</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Filter Group: Cửa hàng */}
            {availableShops.length > 1 && (
              <div className="catalog-filter-group">
                <h3 className="catalog-filter-title">Cửa hàng</h3>
                <ul className="catalog-filter-list">
                  <li>
                    <button
                      type="button"
                      className={`catalog-filter-option ${shopFilter === 'all' ? 'is-active' : ''}`}
                      onClick={() => setShopFilter('all')}
                    >
                      <span className="catalog-option-checkbox">
                        {shopFilter === 'all' && <Check size={12} strokeWidth={3} />}
                      </span>
                      <span className="catalog-option-text">Tất cả cửa hàng</span>
                      <span className="catalog-option-count">({rawItems.length})</span>
                    </button>
                  </li>
                  {availableShops.map((shop) => {
                    const count = shopCounts[shop] || 0;
                    const isSelected = shopFilter === shop;
                    return (
                      <li key={shop}>
                        <button
                          type="button"
                          className={`catalog-filter-option ${isSelected ? 'is-active' : ''}`}
                          onClick={() => setShopFilter(isSelected ? 'all' : shop)}
                        >
                          <span className="catalog-option-checkbox">
                            {isSelected && <Check size={12} strokeWidth={3} />}
                          </span>
                          <span className="catalog-option-text">{shop}</span>
                          <span className="catalog-option-count">({count})</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {/* Filter Group: Điểm tủ kiosk */}
            {availableKiosks.length > 1 && (
              <div className="catalog-filter-group">
                <h3 className="catalog-filter-title">Điểm tủ Kiosk</h3>
                <ul className="catalog-filter-list">
                  <li>
                    <button
                      type="button"
                      className={`catalog-filter-option ${kioskFilter === 'all' ? 'is-active' : ''}`}
                      onClick={() => setKioskFilter('all')}
                    >
                      <span className="catalog-option-checkbox">
                        {kioskFilter === 'all' && <Check size={12} strokeWidth={3} />}
                      </span>
                      <span className="catalog-option-text">Tất cả tủ kiosk</span>
                      <span className="catalog-option-count">({rawItems.length})</span>
                    </button>
                  </li>
                  {availableKiosks.map((kiosk) => {
                    const count = kioskCounts[kiosk] || 0;
                    const isSelected = kioskFilter === kiosk;
                    return (
                      <li key={kiosk}>
                        <button
                          type="button"
                          className={`catalog-filter-option ${isSelected ? 'is-active' : ''}`}
                          onClick={() => setKioskFilter(isSelected ? 'all' : kiosk)}
                        >
                          <span className="catalog-option-checkbox">
                            {isSelected && <Check size={12} strokeWidth={3} />}
                          </span>
                          <span className="catalog-option-text">{kiosk}</span>
                          <span className="catalog-option-count">({count})</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </aside>

          {/* RIGHT COLUMN: MAIN CONTENT */}
          <section className="catalog-main-content" aria-label="Danh sách sản phẩm">
            {/* Top Search Bar (E-commerce full width) */}
            <form
              className="catalog-search-bar-wrap"
              role="search"
              onSubmit={(event) => {
                event.preventDefault();
                setPage(1);
                setSearch(draft.trim());
              }}
            >
              <div className="catalog-search-input-box">
                <Search size={18} className="catalog-search-icon" aria-hidden="true" />
                <label htmlFor="flower-search" className="visually-hidden">
                  Tìm mẫu hoa, shop hoặc tủ nhận
                </label>
                <input
                  id="flower-search"
                  className="catalog-search-input"
                  type="search"
                  maxLength={100}
                  placeholder="Tìm kiếm mẫu hoa, shop hoa hoặc điểm tủ kiosk..."
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                />
              </div>
              <Button type="submit" className="catalog-search-submit-btn">
                Tìm hoa
              </Button>
            </form>

            {/* Results Count & Sort Toolbar */}
            <div className="catalog-content-toolbar">
              <div className="catalog-results-count">
                <span>
                  Hiển thị <strong>{displayedItems.length}</strong> mẫu hoa phù hợp
                  {search.trim() && (
                    <span className="catalog-results-query">
                      {' '}
                      cho &ldquo;{search.trim()}&rdquo;
                    </span>
                  )}
                </span>
              </div>

              <div className="catalog-toolbar-right">
                <div className="catalog-sort-wrapper">
                  <select
                    className="catalog-sort-select"
                    aria-label="Sắp xếp sản phẩm"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                  >
                    <option value="default">Sắp xếp: Mặc định</option>
                    <option value="price-asc">Giá: Thấp đến cao</option>
                    <option value="price-desc">Giá: Cao đến thấp</option>
                    <option value="name-asc">Tên: A – Z</option>
                  </select>
                </div>
                <div className="catalog-view-switches" aria-hidden="true">
                  <span className="catalog-view-btn is-active" title="Xem dạng lưới">
                    <LayoutGrid size={16} />
                  </span>
                </div>
              </div>
            </div>

            {/* Loading, Error and Empty states */}
            {catalog.isPending ? (
              <p role="status">Đang tìm những bó hoa dành cho bạn…</p>
            ) : catalog.isError && !displayedItems.length ? (
              <>
                <p role="alert">Chưa tải được mẫu hoa. Bạn thử lại nhé.</p>
                <Button onClick={() => void catalog.refetch()}>Tải lại mẫu hoa</Button>
              </>
            ) : !displayedItems.length ? (
              <div className="member-empty">
                <h2>Chưa có mẫu hoa phù hợp</h2>
                <p>
                  Thử tìm bằng tên khác hoặc điều chỉnh lại bộ lọc giá và dịp tặng. Mẫu hoa xuất
                  hiện khi shop đang hoạt động và có tủ nhận khả dụng.
                </p>
                <Button variant="outline" onClick={resetFilters} style={{ marginTop: '0.75rem' }}>
                  Xóa bộ lọc để xem tất cả
                </Button>
                {!demoEnabled && (
                  <Button
                    variant="default"
                    onClick={() => setDemoEnabled(true)}
                    style={{ marginTop: '0.75rem', marginLeft: '0.5rem' }}
                  >
                    Xem 12 mẫu hoa minh họa
                  </Button>
                )}
              </div>
            ) : (
              <>
                <ul className="flower-catalog-grid flower-catalog">
                  {displayedItems.map((item) => {
                    const hasStock = item.bouquets && item.bouquets.length > 0;
                    const mockItem = item as { occasion?: string };
                    const occBadgeClass = getOccasionBadgeClass(mockItem.occasion);
                    return (
                      <li key={`${item.productId}-${item.kioskId}`} className="flower-card">
                        <div className="flower-card-media">
                          <img
                            src={item.photo || '/images/floral-white-online.webp'}
                            alt={`Mẫu ${item.name} từ ${item.shopName}`}
                            loading="lazy"
                            className="flower-card-img"
                          />
                          <div className="flower-card-badges">
                            <span
                              className={`flower-badge ${hasStock ? 'flower-badge-stock' : 'flower-badge-custom'}`}
                            >
                              {hasStock ? `Có sẵn ${item.bouquets.length} bó` : 'Đặt làm riêng'}
                            </span>
                            {mockItem.occasion && (
                              <span
                                className={`flower-badge flower-badge-occasion ${occBadgeClass}`}
                              >
                                {mockItem.occasion}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flower-card-body">
                          <h2 className="flower-card-title">{item.name}</h2>
                          <p className="flower-card-desc">
                            {item.description || 'Hoa tươi chọn lọc chất lượng cao từ shop uy tín.'}
                          </p>

                          <div className="flower-card-meta">
                            <span className="flower-meta-item">
                              <Store size={14} aria-hidden="true" />
                              <span>{item.shopName}</span>
                            </span>
                            <span className="flower-meta-item">
                              <MapPin size={14} aria-hidden="true" />
                              <span>{item.kioskName}</span>
                            </span>
                          </div>

                          <div className="flower-card-price-row">
                            <div>
                              <span className="flower-card-price">
                                {item.price.toLocaleString('vi-VN')} đ
                              </span>
                              <span className="flower-card-price-label"> · giá mẫu</span>
                            </div>
                          </div>

                          <div className="flower-card-actions">
                            <Button
                              className="flower-card-select-btn"
                              onClick={() => {
                                setSelected(item);
                                window.scrollTo({ top: 0, behavior: 'instant' });
                              }}
                            >
                              Chọn mẫu và cách nhận
                            </Button>
                            <div className="flower-card-secondary-btns">
                              <Button
                                variant="outline"
                                className="flower-card-detail-btn"
                                onClick={(e) => openDetailModal(item, e.currentTarget)}
                              >
                                Xem chi tiết
                              </Button>
                              <Button
                                variant="outline"
                                type="button"
                                className="chat-open-btn flower-card-chat-btn"
                                disabled={openingChatId === item.productId}
                                onClick={() => void handleOpenChat(item)}
                              >
                                <MessageSquare size={13} aria-hidden="true" />
                                <span>
                                  {openingChatId === item.productId
                                    ? 'Đang mở…'
                                    : 'Nhắn tin với shop'}
                                </span>
                              </Button>
                            </div>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                {hasLiveItems && (
                  <nav className="stock-actions" aria-label="Phân trang mẫu hoa">
                    <Button
                      variant="outline"
                      disabled={page === 1 || catalog.isFetching}
                      onClick={() => setPage((value) => value - 1)}
                    >
                      Trang trước
                    </Button>
                    <span>Trang {page}</span>
                    <Button
                      variant="outline"
                      disabled={!catalog.data?.hasMore || catalog.isFetching}
                      onClick={() => setPage((value) => value + 1)}
                    >
                      Trang sau
                    </Button>
                  </nav>
                )}
              </>
            )}
          </section>
        </div>

        {/* Product Detail Modal */}
        {detailModalItem && (
          <div className="product-modal-backdrop">
            <button
              type="button"
              className="product-modal-scrim"
              aria-label="Đóng chi tiết sản phẩm"
              onClick={closeDetailModal}
            />
            <div
              ref={modalContentRef}
              className="product-modal-content"
              role="dialog"
              aria-modal="true"
              aria-labelledby="product-modal-title"
            >
              <button
                ref={modalCloseBtnRef}
                type="button"
                className="product-modal-close-btn"
                aria-label="Đóng chi tiết sản phẩm"
                onClick={closeDetailModal}
              >
                <X size={20} aria-hidden="true" />
              </button>

              <div className="product-modal-media">
                <img
                  src={detailModalItem.photo || '/images/floral-white-online.webp'}
                  alt={detailModalItem.name}
                  className="product-modal-img"
                />
              </div>

              <div className="product-modal-body">
                <div>
                  <h2 id="product-modal-title" className="product-modal-title">
                    {detailModalItem.name}
                  </h2>
                  <p style={{ color: '#385540', fontSize: '0.9rem', marginTop: '0.25rem' }}>
                    Shop: <strong>{detailModalItem.shopName}</strong> · Tủ nhận:{' '}
                    <strong>{detailModalItem.kioskName}</strong> ({detailModalItem.address})
                  </p>
                </div>

                <div className="product-modal-price">
                  {detailModalItem.price.toLocaleString('vi-VN')} đ{' '}
                  <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#34523e' }}>
                    · giá mẫu tham khảo
                  </span>
                </div>

                <p style={{ color: '#385540', lineHeight: 1.6, fontSize: '0.95rem' }}>
                  {detailModalItem.description ||
                    'Sản phẩm được chế tác tỉ mỉ từ các loại hoa tươi tuyển chọn, đảm bảo độ tươi mới và sang trọng.'}
                </p>

                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span
                    className={`flower-badge ${detailModalItem.bouquets.length ? 'flower-badge-stock' : 'flower-badge-custom'}`}
                  >
                    {detailModalItem.bouquets.length
                      ? `Có sẵn ${detailModalItem.bouquets.length} bó tại tủ`
                      : 'Đặt thiết kế riêng theo yêu cầu'}
                  </span>
                  {(detailModalItem as { occasion?: string }).occasion && (
                    <span className="flower-badge flower-badge-occasion">
                      Dịp: {(detailModalItem as { occasion?: string }).occasion}
                    </span>
                  )}
                </div>

                <div className="product-modal-form-wrap">
                  <h3 style={{ fontSize: '1.05rem', color: '#113421', marginBottom: '0.75rem' }}>
                    Đặt bó hoa này
                  </h3>
                  <RequestForm
                    key={`modal-${detailModalItem.productId}-${detailModalItem.kioskId}`}
                    item={detailModalItem}
                  />
                </div>

                <div style={{ marginTop: '0.5rem' }}>
                  <Button
                    variant="outline"
                    type="button"
                    className="chat-open-btn"
                    style={{ width: '100%', minHeight: '44px' }}
                    disabled={openingChatId === detailModalItem.productId}
                    onClick={() => void handleOpenChat(detailModalItem)}
                  >
                    <MessageSquare size={16} aria-hidden="true" />
                    {openingChatId === detailModalItem.productId
                      ? 'Đang mở chat…'
                      : 'Nhắn tin với shop'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
