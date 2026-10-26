import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  Button,
  Check,
  Flower2,
  MapPin,
  MessageSquare,
  RotateCcw,
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
  occasion?: string;
  tags?: string[];
  isDemoSample?: boolean;
};
type Catalog = { items: Item[]; page: number; hasMore: boolean };
const OCCASIONS = [
  'Sinh nhật',
  'Khai trương',
  'Tình yêu',
  'Tốt nghiệp',
  'Cảm ơn',
  'Kỷ niệm',
  'Chúc mừng',
];

function matchesOccasion(item: Item, occasion: string) {
  return Boolean(
    item.occasion === occasion ||
    item.tags?.includes(occasion) ||
    item.description?.toLowerCase().includes(occasion.toLowerCase()),
  );
}

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
    if (item.isDemoSample) {
      setError('Mẫu minh họa chỉ dùng để xem giao diện và không thể tạo đơn thật.');
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
      } else setUncertain(true);
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
  if (item.isDemoSample)
    return (
      <p role="note">
        Mẫu minh họa để xem giao diện. Không tạo đơn, thanh toán hoặc tin nhắn cho mẫu này.
      </p>
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
  const filterToggleRef = useRef<HTMLButtonElement | null>(null);
  const closeMobileFilters = () => {
    setMobileFiltersOpen(false);
    filterToggleRef.current?.focus();
  };
  const [demoEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return params.get('demo') === '1' || params.get('demo') === 'true';
  });

  const catalog = useQuery({
    queryKey: ['web-catalog', search, page],
    queryFn: () =>
      request<Catalog>(`/shop/catalog?page=${page}&search=${encodeURIComponent(search)}`),
  });

  const modalTriggerRef = useRef<HTMLElement | null>(null);
  const modalCloseBtnRef = useRef<HTMLButtonElement | null>(null);
  const modalContentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!mobileFiltersOpen || detailModalItem) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileFiltersOpen(false);
        filterToggleRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [mobileFiltersOpen, detailModalItem]);

  useEffect(() => {
    if (mobileFiltersOpen) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [mobileFiltersOpen]);

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
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
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
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [detailModalItem]);

  const handleOpenChat = useCallback(
    async (item: Item) => {
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

  // Prefer backend data. Demo data is opt-in via ?demo=1 and never creates real writes.
  const hasLiveItems = (catalog.data?.items?.length ?? 0) > 0;
  const rawItems: Item[] = useMemo(() => {
    if (demoEnabled) {
      return MOCK_CATALOG_ITEMS.map((item) => ({ ...item, isDemoSample: true }));
    }
    return catalog.data?.items ?? [];
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
    if (priceFilter === '600to1000' && (item.price <= 600000 || item.price > 1000000)) return false;
    if (priceFilter === 'over1000' && item.price <= 1000000) return false;

    // Occasion / Tag filter
    if (occasionFilter !== 'all' && !matchesOccasion(item, occasionFilter)) return false;

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
  const occasionList = OCCASIONS;

  // Aggregated counts for filter checkboxes
  const occasionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    OCCASIONS.forEach((occasion) => {
      counts[occasion] = rawItems.filter((item) => matchesOccasion(item, occasion)).length;
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

  const hasActiveFilters = Boolean(
    search.trim() ||
    priceFilter !== 'all' ||
    occasionFilter !== 'all' ||
    shopFilter !== 'all' ||
    kioskFilter !== 'all' ||
    availabilityFilter !== 'all',
  );

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
        '600to1000': 'Trên 600k – 1tr',
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
        label: availabilityFilter === 'stock' ? 'Có sẵn tại tủ' : 'Đặt trước (Pre-order)',
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
          <div className="catalog-header-left">
            <h1 id="catalog-hero-title" className="catalog-hero-title">
              Chọn hoa cho một dịp thật riêng.
            </h1>
          </div>
          <p className="catalog-hero-desc">
            Đặt mẫu bạn thích để shop gửi đến tủ gần bạn, hoặc nhận ngay bó có sẵn.
          </p>
        </header>

        {chatError && (
          <p role="alert" className="error" style={{ marginBlock: '1rem' }}>
            {chatError}
          </p>
        )}

        {/* Selected flower ordering form (preserves existing preorder test flow) */}
        {selected && (
          <section className="flower-request" aria-labelledby="selected-flower">
            <div className="flower-request-heading">
              <h2 id="selected-flower" className="flower-request-title">
                Đặt {selected.name}
              </h2>
              <Button variant="outline" onClick={() => setSelected(null)}>
                Đóng mẫu đang chọn
              </Button>
            </div>
            <p className="flower-request-meta">
              {selected.shopName} · {selected.kioskName}
            </p>
            <RequestForm key={`${selected.productId}-${selected.kioskId}`} item={selected} />
            <div className="flower-request-actions">
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

        {/* Mobile Filter Backdrop */}
        {mobileFiltersOpen && (
          <div className="catalog-sheet-backdrop" onClick={closeMobileFilters} aria-hidden="true" />
        )}

        {/* Main 2-Column Layout: Sidebar Filters (Left) + Content Area (Right) */}
        <div className="catalog-main-layout">
          {/* LEFT SIDEBAR: FILTERS (Bottom sheet on mobile) */}
          <aside
            id="catalog-filters"
            className={`catalog-sidebar ${mobileFiltersOpen ? 'is-mobile-open' : ''}`}
            aria-label="Bộ lọc sản phẩm"
          >
            <div className="catalog-sheet-drag-handle" aria-hidden="true" />
            <div className="catalog-sidebar-header">
              <h2 className="catalog-sidebar-title">
                <SlidersHorizontal size={18} aria-hidden="true" />
                <span>Bộ lọc</span>
              </h2>
              <div className="catalog-sidebar-header-actions">
                {hasActiveFilters && (
                  <button
                    type="button"
                    className="catalog-sidebar-reset-btn"
                    onClick={resetFilters}
                    title="Đặt lại bộ lọc"
                    aria-label="Đặt lại bộ lọc"
                  >
                    <X size={15} aria-hidden="true" />
                  </button>
                )}
                <button
                  type="button"
                  className="catalog-sheet-close-btn"
                  onClick={closeMobileFilters}
                  title="Đóng bộ lọc"
                  aria-label="Đóng bộ lọc"
                >
                  <X size={18} aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="catalog-sidebar-scroll-body">
              {/* Filter Group: Dịp tặng */}
              <div className="catalog-filter-group">
                <h3 className="catalog-filter-title">Dịp tặng</h3>
                <ul className="catalog-filter-list">
                  <li>
                    <button
                      type="button"
                      className={`catalog-filter-option ${occasionFilter === 'all' ? 'is-active' : ''}`}
                      aria-pressed={occasionFilter === 'all'}
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
                    const isEmpty = count === 0;
                    return (
                      <li key={occ}>
                        <button
                          type="button"
                          className={`catalog-filter-option ${isSelected ? 'is-active' : ''} ${isEmpty ? 'is-empty' : ''}`}
                          aria-pressed={isSelected}
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
                      label: 'Trên 600.000 đ đến 1.000.000 đ',
                      count: priceCounts.range600to1000,
                    },
                    { id: 'over1000', label: 'Trên 1.000.000 đ', count: priceCounts.over1000 },
                  ].map((tier) => {
                    const isSelected = priceFilter === tier.id;
                    const isEmpty = tier.id !== 'all' && tier.count === 0;
                    return (
                      <li key={tier.id}>
                        <button
                          type="button"
                          className={`catalog-filter-option ${isSelected ? 'is-active' : ''} ${isEmpty ? 'is-empty' : ''}`}
                          aria-pressed={isSelected}
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
                <h3 className="catalog-filter-title">Hình thức nhận hoa</h3>
                <ul className="catalog-filter-list">
                  {[
                    { id: 'all', label: 'Tất cả tình trạng', count: rawItems.length },
                    { id: 'stock', label: 'Có sẵn tại tủ kiosk', count: availabilityCounts.stock },
                    {
                      id: 'custom',
                      label: 'Đặt trước (Pre-order)',
                      count: availabilityCounts.custom,
                    },
                  ].map((avail) => {
                    const isSelected = availabilityFilter === avail.id;
                    const isEmpty = avail.id !== 'all' && avail.count === 0;
                    return (
                      <li key={avail.id}>
                        <button
                          type="button"
                          className={`catalog-filter-option ${isSelected ? 'is-active' : ''} ${isEmpty ? 'is-empty' : ''}`}
                          aria-pressed={isSelected}
                          onClick={() =>
                            setAvailabilityFilter(
                              isSelected && avail.id !== 'all' ? 'all' : avail.id,
                            )
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
                        aria-pressed={shopFilter === 'all'}
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
                      const isEmpty = count === 0;
                      return (
                        <li key={shop}>
                          <button
                            type="button"
                            className={`catalog-filter-option ${isSelected ? 'is-active' : ''} ${isEmpty ? 'is-empty' : ''}`}
                            aria-pressed={isSelected}
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
                        aria-pressed={kioskFilter === 'all'}
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
                      const isEmpty = count === 0;
                      return (
                        <li key={kiosk}>
                          <button
                            type="button"
                            className={`catalog-filter-option ${isSelected ? 'is-active' : ''} ${isEmpty ? 'is-empty' : ''}`}
                            aria-pressed={isSelected}
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
            </div>

            {/* Bottom Sheet Sticky Action Bar (Mobile only) */}
            <div className="catalog-sheet-footer">
              {hasActiveFilters && (
                <button type="button" className="catalog-sheet-reset-btn" onClick={resetFilters}>
                  <RotateCcw size={14} aria-hidden="true" />
                  <span>Đặt lại</span>
                </button>
              )}
              <button
                type="button"
                className="catalog-mobile-apply-btn"
                onClick={closeMobileFilters}
                aria-label={`Xem ${displayedItems.length} mẫu phù hợp`}
              >
                Áp dụng {displayedItems.length > 0 ? `(${displayedItems.length} mẫu)` : ''}
              </button>
            </div>
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
                <label htmlFor="flower-search" className="sr-only">
                  Tìm mẫu hoa, shop hoặc tủ nhận
                </label>
                <input
                  id="flower-search"
                  className="catalog-search-input"
                  type="search"
                  maxLength={100}
                  placeholder="Tìm hoa, shop hoặc tủ nhận…"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                />
                {draft && (
                  <button
                    type="button"
                    className="catalog-search-clear-btn"
                    aria-label="Xóa nội dung tìm kiếm"
                    onClick={() => {
                      setDraft('');
                      if (search) {
                        setPage(1);
                        setSearch('');
                      }
                    }}
                  >
                    <X size={16} aria-hidden="true" />
                  </button>
                )}
              </div>
              <Button type="submit" className="catalog-search-submit-btn">
                Tìm hoa
              </Button>
            </form>

            {/* Results Count & Sort Toolbar (includes mobile filter button on small screens) */}
            {(displayedItems.length > 0 || hasActiveFilters) && (
              <div className="catalog-content-toolbar">
                <div className="catalog-toolbar-left">
                  <button
                    ref={filterToggleRef}
                    type="button"
                    className={`catalog-mobile-filter-btn ${activeFilters.length > 0 ? 'is-filtered' : ''}`}
                    onClick={() => setMobileFiltersOpen((prev) => !prev)}
                    aria-expanded={mobileFiltersOpen}
                    aria-controls="catalog-filters"
                  >
                    <SlidersHorizontal size={15} aria-hidden="true" />
                    <span>Bộ lọc</span>
                    {activeFilters.length > 0 && (
                      <span className="catalog-filter-badge">{activeFilters.length}</span>
                    )}
                  </button>

                  {activeFilters.length > 0 && (
                    <button
                      type="button"
                      className="catalog-mobile-clear-btn"
                      onClick={resetFilters}
                    >
                      Xóa tất cả
                    </button>
                  )}

                  <div className="catalog-results-count" role="status" aria-live="polite">
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
                </div>
              </div>
            )}

            {/* Loading, Error and Empty states */}
            {catalog.isPending ? (
              <div className="catalog-loading-state">
                <p role="status">Đang tìm những bó hoa dành cho bạn…</p>
              </div>
            ) : catalog.isError && !displayedItems.length ? (
              <div className="catalog-empty-card">
                <div className="catalog-empty-icon-wrap is-error">
                  <Flower2 size={38} strokeWidth={1.5} aria-hidden="true" />
                </div>
                <h2 className="catalog-empty-title">Chưa tải được danh mục hoa</h2>
                <p className="catalog-empty-desc">
                  Hệ thống tạm thời chưa kết nối được máy chủ danh mục. Bạn thử tải lại nhé.
                </p>
                <Button onClick={() => void catalog.refetch()}>Tải lại mẫu hoa</Button>
              </div>
            ) : !displayedItems.length ? (
              <div className="catalog-empty-card">
                <div className="catalog-empty-icon-wrap">
                  <Flower2 size={40} strokeWidth={1.5} aria-hidden="true" />
                </div>
                <h2 className="catalog-empty-title">
                  {search.trim()
                    ? `Không tìm thấy mẫu hoa nào cho "${search.trim()}"`
                    : hasActiveFilters
                      ? 'Không có mẫu hoa nào khớp với bộ lọc'
                      : 'Hiện chưa có mẫu hoa nào đang mở bán'}
                </h2>
                <p className="catalog-empty-desc">
                  {search.trim() || hasActiveFilters
                    ? 'Bạn thử kiểm tra lại chính tả từ khóa, hoặc đặt lại bộ lọc dịp tặng và khoảng giá để xem toàn bộ danh mục hoa có sẵn nhé.'
                    : 'Các cửa hàng hoa đang chuẩn bị và cập nhật thêm sản phẩm tại tủ kiosk. Bạn vui lòng quay lại sau nhé!'}
                </p>
                {hasActiveFilters && (
                  <div className="catalog-empty-actions">
                    <Button className="catalog-empty-reset-btn" onClick={resetFilters}>
                      <RotateCcw size={15} aria-hidden="true" />
                      <span>Xóa bộ lọc để xem tất cả</span>
                    </Button>
                  </div>
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
                            onError={(e) => {
                              const target = e.currentTarget;
                              if (!target.dataset.fallback) {
                                target.dataset.fallback = '1';
                                target.src = '/images/floral-white-online.webp';
                              }
                            }}
                          />
                          <div className="flower-card-badges">
                            <span
                              className={`flower-badge ${hasStock ? 'flower-badge-stock' : 'flower-badge-custom'}`}
                            >
                              {hasStock ? `Có sẵn ${item.bouquets.length} bó` : 'Đặt trước'}
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
                            {item.description || 'Mẫu hoa do shop thiết kế theo yêu cầu của bạn.'}
                          </p>

                          <div className="flower-card-meta">
                            <span className="flower-meta-item" title={item.shopName}>
                              <Store size={14} aria-hidden="true" />
                              <span>{item.shopName}</span>
                            </span>
                            <span className="flower-meta-item" title={item.kioskName}>
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
                              aria-label="Chọn mẫu và cách nhận"
                              onClick={() => {
                                setSelected(item);
                                window.scrollTo({ top: 0, behavior: 'instant' });
                              }}
                            >
                              Chọn mẫu
                            </Button>
                            <div className="flower-card-secondary-btns">
                              <Button
                                variant="outline"
                                className="flower-card-detail-btn"
                                aria-label="Xem chi tiết"
                                onClick={(e) => openDetailModal(item, e.currentTarget)}
                              >
                                Chi tiết
                              </Button>
                              <Button
                                variant="outline"
                                type="button"
                                className="chat-open-btn flower-card-chat-btn"
                                disabled={openingChatId === item.productId}
                                title={`Nhắn tin với ${item.shopName}`}
                                aria-label="Nhắn tin với shop"
                                onClick={() => void handleOpenChat(item)}
                              >
                                <MessageSquare size={14} aria-hidden="true" />
                                <span>
                                  {openingChatId === item.productId ? 'Đang mở…' : 'Chat'}
                                </span>
                              </Button>
                            </div>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                {hasLiveItems && (catalog.data?.hasMore || page > 1) && (
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
                  onError={(e) => {
                    const target = e.currentTarget;
                    if (!target.dataset.fallback) {
                      target.dataset.fallback = '1';
                      target.src = '/images/floral-white-online.webp';
                    }
                  }}
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
                    'Mẫu hoa do shop thiết kế. Hãy trao đổi với shop về màu sắc, kích thước và phụ kiện trước khi xác nhận báo giá.'}
                </p>

                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span
                    className={`flower-badge ${detailModalItem.bouquets.length ? 'flower-badge-stock' : 'flower-badge-custom'}`}
                  >
                    {detailModalItem.bouquets.length
                      ? `Có sẵn ${detailModalItem.bouquets.length} bó tại tủ`
                      : 'Đặt trước (Pre-order) theo yêu cầu'}
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
