import { useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@florabot/ui';
import { ApiError, queryClient, request, sessionQuery } from './api';
import { MemberHeader } from './MemberAccount';

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
        <Link to="/tai-khoan">Theo dõi và thanh toán trong tài khoản</Link>
      </div>
    );
  if (!session.data)
    return (
      <p>
        <Link to="/dang-nhap">Đăng nhập</Link> hoặc <Link to="/dang-ky">tạo tài khoản</Link> để đặt
        hoa và theo dõi đơn.
      </p>
    );
  if (session.data.role !== 'CUSTOMER')
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
            thời hạn ghi trên đơn (tối đa 2 giờ, tùy độ tươi của hoa).
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
          <Link to="/tai-khoan">Kiểm tra yêu cầu trong tài khoản</Link>
        </p>
      )}
    </form>
  );
}
export default function FlowerShop() {
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Item | null>(null);
  const catalog = useQuery({
    queryKey: ['web-catalog', search, page],
    queryFn: () =>
      request<Catalog>(`/shop/catalog?page=${page}&search=${encodeURIComponent(search)}`),
  });
  return (
    <>
      <MemberHeader />
      <main id="main" className="member-page flower-shop">
        <h1>Chọn hoa cho một dịp thật riêng.</h1>
        <p>
          Đặt mẫu bạn thích, để shop chăm chút và gửi đến tủ gần bạn. Cần hoa sớm? Chọn một bó đang
          có sẵn tại tủ.
        </p>
        <form
          className="catalog-search"
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            setPage(1);
            setSearch(draft.trim());
          }}
        >
          <label htmlFor="flower-search">Tìm mẫu hoa, shop hoặc tủ nhận</label>
          <input
            id="flower-search"
            type="search"
            maxLength={100}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <Button type="submit">Tìm hoa</Button>
        </form>
        {selected && (
          <section className="flower-request" aria-labelledby="selected-flower">
            <h2 id="selected-flower">Đặt {selected.name}</h2>
            <p>
              {selected.shopName} · {selected.kioskName}
            </p>
            <RequestForm key={`${selected.productId}-${selected.kioskId}`} item={selected} />
            <Button variant="outline" onClick={() => setSelected(null)}>
              Đóng mẫu đang chọn
            </Button>
          </section>
        )}
        {catalog.isPending ? (
          <p role="status">Đang tìm những bó hoa dành cho bạn…</p>
        ) : catalog.isError ? (
          <>
            <p role="alert">Chưa tải được mẫu hoa. Bạn thử lại nhé.</p>
            <Button onClick={() => void catalog.refetch()}>Tải lại mẫu hoa</Button>
          </>
        ) : (
          <>
            {!catalog.data.items.length && (
              <div className="member-empty">
                <h2>Chưa có mẫu hoa phù hợp</h2>
                <p>
                  Thử tìm bằng tên khác. Mẫu hoa xuất hiện khi shop đang hoạt động và có tủ nhận khả
                  dụng.
                </p>
              </div>
            )}
            <ul className="flower-catalog">
              {catalog.data.items.map((item) => (
                <li key={`${item.productId}-${item.kioskId}`}>
                  {item.photo && (
                    <img
                      src={item.photo}
                      alt={`Mẫu ${item.name} từ ${item.shopName}`}
                      loading="lazy"
                      width="480"
                      height="360"
                    />
                  )}
                  <div>
                    <h2>{item.name}</h2>
                    <p>{item.description}</p>
                    <p>
                      {item.shopName} · {item.kioskName}
                    </p>
                    <p>{item.address}</p>
                    <p>
                      <strong>{item.price.toLocaleString('vi-VN')} đ</strong> · giá mẫu
                    </p>
                    <Button
                      onClick={() => {
                        setSelected(item);
                        window.scrollTo({ top: 0, behavior: 'instant' });
                      }}
                    >
                      Chọn mẫu và cách nhận
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
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
                disabled={!catalog.data.hasMore || catalog.isFetching}
                onClick={() => setPage((value) => value + 1)}
              >
                Trang sau
              </Button>
            </nav>
          </>
        )}
      </main>
    </>
  );
}
