import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Button, Flower2, MapPin, MessageSquare, Store, X } from '@florabot/ui';
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
    setError('');
    setUncertain(true);
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

  useEffect(() => {
    if (!detailModalItem) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDetailModalItem(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [detailModalItem]);

  async function handleOpenChat(item: Item) {
    if (!session.data) {
      router.push(`/dang-nhap?returnUrl=${encodeURIComponent('/dat-hoa')}`);
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
      router.push(`/tai-khoan?chat=${encodeURIComponent(chat.id)}#member-chats`);
    } catch (err) {
      setChatError(formatChatError(err));
    } finally {
      setOpeningChatId(null);
    }
  }

  // Base items: prefer real API items if available; otherwise use MOCK_CATALOG_ITEMS if demoEnabled
  const hasLiveItems = (catalog.data?.items?.length ?? 0) > 0;
  const rawItems: Item[] = hasLiveItems
    ? (catalog.data?.items ?? [])
    : demoEnabled
      ? MOCK_CATALOG_ITEMS
      : [];

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

  // Unique options for filter dropdowns
  const availableShops = Array.from(new Set(rawItems.map((i) => i.shopName))).filter(Boolean);
  const availableKiosks = Array.from(new Set(rawItems.map((i) => i.kioskName))).filter(Boolean);

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

  return (
    <>
      <main id="main" className="flower-shop-page">
        {/* Catalog Hero */}
        <section className="catalog-hero" aria-labelledby="catalog-hero-title">
          <div className="catalog-hero-header">
            <Flower2 size={20} aria-hidden="true" />
            <span>Danh mục hoa tươi & thiết kế riêng</span>
          </div>
          <h1 id="catalog-hero-title" className="catalog-hero-title">
            Chọn hoa cho một dịp thật riêng.
          </h1>
          <p className="catalog-hero-desc">
            Đặt mẫu bạn thích, để shop chăm chút và gửi đến tủ gần bạn. Cần hoa sớm? Chọn một bó
            đang có sẵn tại tủ để nhận ngay không cần chờ cắm.
          </p>

          <form
            className="catalog-search-bar"
            role="search"
            onSubmit={(event) => {
              event.preventDefault();
              setPage(1);
              setSearch(draft.trim());
            }}
          >
            <div className="catalog-search-input-wrap">
              <label htmlFor="flower-search" className="visually-hidden">
                Tìm mẫu hoa, shop hoặc tủ nhận
              </label>
              <input
                id="flower-search"
                className="catalog-search-input"
                type="search"
                maxLength={100}
                placeholder="Tìm mẫu hoa, tên shop hoặc tủ nhận..."
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
              />
            </div>
            <Button type="submit" className="catalog-search-btn">
              Tìm hoa
            </Button>
          </form>
        </section>

        {/* Demo Mode Toggle Banner */}
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

        {/* Filters and Sort Bar */}
        <section className="catalog-filters-bar" aria-label="Bộ lọc và sắp xếp">
          <div className="catalog-filters-row">
            <select
              className="catalog-filter-select"
              aria-label="Lọc theo mức giá"
              value={priceFilter}
              onChange={(e) => setPriceFilter(e.target.value)}
            >
              <option value="all">Tất cả mức giá</option>
              <option value="under300">Dưới 300.000 đ</option>
              <option value="300to600">300.000 đ – 600.000 đ</option>
              <option value="600to1000">600.000 đ – 1.000.000 đ</option>
              <option value="over1000">Trên 1.000.000 đ</option>
            </select>

            <select
              className="catalog-filter-select"
              aria-label="Lọc theo dịp tặng"
              value={occasionFilter}
              onChange={(e) => setOccasionFilter(e.target.value)}
            >
              <option value="all">Tất cả dịp tặng</option>
              <option value="Sinh nhật">Sinh nhật</option>
              <option value="Tình yêu">Tình yêu & Kỷ niệm</option>
              <option value="Khai trương">Khai trương</option>
              <option value="Chúc mừng">Chúc mừng</option>
              <option value="Tốt nghiệp">Tốt nghiệp</option>
              <option value="Cảm ơn">Cảm ơn</option>
            </select>

            {availableShops.length > 1 && (
              <select
                className="catalog-filter-select"
                aria-label="Lọc theo cửa hàng"
                value={shopFilter}
                onChange={(e) => setShopFilter(e.target.value)}
              >
                <option value="all">Tất cả cửa hàng</option>
                {availableShops.map((shop) => (
                  <option key={shop} value={shop}>
                    {shop}
                  </option>
                ))}
              </select>
            )}

            {availableKiosks.length > 1 && (
              <select
                className="catalog-filter-select"
                aria-label="Lọc theo điểm nhận tủ kiosk"
                value={kioskFilter}
                onChange={(e) => setKioskFilter(e.target.value)}
              >
                <option value="all">Tất cả tủ kiosk</option>
                {availableKiosks.map((kiosk) => (
                  <option key={kiosk} value={kiosk}>
                    {kiosk}
                  </option>
                ))}
              </select>
            )}

            <select
              className="catalog-filter-select"
              aria-label="Lọc theo tình trạng khả dụng"
              value={availabilityFilter}
              onChange={(e) => setAvailabilityFilter(e.target.value)}
            >
              <option value="all">Tất cả tình trạng</option>
              <option value="stock">Có sẵn tại tủ</option>
              <option value="custom">Đặt theo yêu cầu</option>
            </select>

            <select
              className="catalog-filter-select"
              aria-label="Sắp xếp sản phẩm"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{ marginLeft: 'auto' }}
            >
              <option value="default">Sắp xếp: Mặc định</option>
              <option value="price-asc">Giá: Thấp đến cao</option>
              <option value="price-desc">Giá: Cao đến thấp</option>
              <option value="name-asc">Tên: A – Z</option>
            </select>

            <Button variant="outline" className="catalog-filter-reset" onClick={resetFilters}>
              Đặt lại bộ lọc
            </Button>
          </div>
        </section>

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

        {/* Results Counter */}
        <div className="catalog-results-info">
          <span>
            Hiển thị <strong>{displayedItems.length}</strong> mẫu hoa phù hợp
          </span>
        </div>

        {/* Loading and Error States */}
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
              Thử tìm bằng tên khác hoặc điều chỉnh lại bộ lọc giá và dịp tặng. Mẫu hoa xuất hiện
              khi shop đang hoạt động và có tủ nhận khả dụng.
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
            <ul className="flower-catalog-grid">
              {displayedItems.map((item) => {
                const hasStock = item.bouquets && item.bouquets.length > 0;
                const mockItem = item as { occasion?: string };
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
                          <span className="flower-badge flower-badge-occasion">
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
                        <div className="flower-card-main-btns">
                          <Button
                            onClick={() => {
                              setSelected(item);
                              window.scrollTo({ top: 0, behavior: 'instant' });
                            }}
                          >
                            Chọn mẫu và cách nhận
                          </Button>
                          <Button variant="outline" onClick={() => setDetailModalItem(item)}>
                            Xem chi tiết
                          </Button>
                        </div>
                        <Button
                          variant="outline"
                          type="button"
                          className="chat-open-btn flower-card-chat-btn"
                          disabled={openingChatId === item.productId}
                          onClick={() => void handleOpenChat(item)}
                        >
                          <MessageSquare size={15} aria-hidden="true" />
                          {openingChatId === item.productId ? 'Đang mở chat…' : 'Nhắn tin với shop'}
                        </Button>
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

        {/* Product Detail Modal */}
        {detailModalItem && (
          <div className="product-modal-backdrop">
            <button
              type="button"
              className="product-modal-scrim"
              aria-label="Đóng chi tiết sản phẩm"
              onClick={() => setDetailModalItem(null)}
            />
            <div
              className="product-modal-content"
              role="dialog"
              aria-modal="true"
              aria-labelledby="product-modal-title"
            >
              <button
                type="button"
                className="product-modal-close-btn"
                aria-label="Đóng chi tiết sản phẩm"
                onClick={() => setDetailModalItem(null)}
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
