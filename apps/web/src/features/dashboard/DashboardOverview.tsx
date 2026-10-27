import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';
import {
  Button,
  ArrowRight,
  Check,
  CircleAlert,
  Store,
  Flower2,
  Wallet,
  ClipboardList,
  RefreshCw,
} from '@florabot/ui';
import type { components } from '../../../../../packages/contracts/src/generated/api';
import { request, type Session } from '../../api';
import type { WebOrder } from '../orders/orders.types';
import { statusName } from '../orders/orders.utils';
import WorkspaceWelcome from '../../shared/components/WorkspaceWelcome';

type Row = { id: string; title: string; detail: string; state: string };
type Feed = { rows: Row[]; more: boolean };
type Page<T> = { items: T[]; hasMore: boolean };
type Incident = components['schemas']['AdminIncidentResponse'];
type Task = { id: string; kioskName: string; assigneeName: string; kind: string };
const date = (value: string) =>
  new Date(value).toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    dateStyle: 'short',
    timeStyle: 'short',
  });
const money = (value: number | string | null) =>
  value === null
    ? 'Chưa có dữ liệu'
    : Number(value).toLocaleString('vi-VN', { style: 'currency', currency: 'VND' });
async function readFeed<T>(url: string, toRow: (value: T) => Row): Promise<Feed> {
  const result = await request<Page<T>>(url);
  if (!Array.isArray(result.items)) throw new Error('Invalid dashboard response');
  return { rows: result.items.map(toRow), more: result.hasMore };
}
function FeedPanel({
  title,
  query,
  href,
  empty,
  action,
}: {
  title: string;
  query: UseQueryResult<Feed>;
  href: string;
  empty: string;
  action: string;
}) {
  return (
    <section className="dashboard-panel" aria-label={title}>
      <div className="dashboard-panel-heading">
        <h2>{title}</h2>
        <Link href={href}>
          {action}
          <ArrowRight size={17} aria-hidden="true" />
        </Link>
      </div>
      {query.isPending ? (
        <p role="status" className="dashboard-placeholder">
          Đang tải danh sách…
        </p>
      ) : query.isError ? (
        <div className="dashboard-empty">
          <CircleAlert size={28} aria-hidden="true" />
          <p role="alert">
            Chưa tải được {title.toLocaleLowerCase('vi-VN')}. Dữ liệu lỗi không được tính là danh
            sách trống.
          </p>
          <Button
            variant="outline"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            Thử lại {title.toLocaleLowerCase('vi-VN')}
          </Button>
        </div>
      ) : query.data.rows.length === 0 ? (
        <div className="dashboard-empty">
          <Check size={28} aria-hidden="true" />
          <h3>Chưa có mục nào trong danh sách</h3>
          <p>{empty}</p>
        </div>
      ) : (
        <ul className="dashboard-feed">
          {query.data.rows.slice(0, 5).map((row) => (
            <li key={row.id}>
              <div>
                <strong>{row.title}</strong>
                <p>{row.detail}</p>
              </div>
              <span className="dashboard-status" data-state={row.state}>
                {row.state}
              </span>
            </li>
          ))}
        </ul>
      )}
      {query.isSuccess && (
        <p className="dashboard-data-note">
          {query.data.more || query.data.rows.length > 5
            ? 'Hiển thị tối đa 5 mục từ trang đầu. Mở danh sách để xem tiếp.'
            : 'Dữ liệu từ trang đầu của danh sách.'}{' '}
          Cập nhật lúc{' '}
          {new Date(query.dataUpdatedAt).toLocaleTimeString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
          })}
          .
        </p>
      )}
    </section>
  );
}
function OrderFeed({ session }: { session: Session }) {
  const admin = session.role === 'ADMIN';
  const base = admin ? '/admin' : `/sellers/${session.sellerId}`;
  const query = useQuery({
    queryKey: ['dashboard-orders', session.id, base],
    queryFn: () =>
      readFeed<WebOrder>(`${base}/preorders?page=1`, (row) => ({
        id: row.id,
        title: row.productName || row.orderCode || 'Yêu cầu đặt hoa',
        detail: `${row.kioskName || 'Tủ nhận'} · Hẹn nhận ${date(row.pickupAt)}`,
        state: statusName(row),
      })),
    refetchInterval: 60_000,
  });
  return (
    <FeedPanel
      title="Yêu cầu đặt hoa gần đây"
      query={query}
      href={admin ? '/admin/orders' : '/seller/orders'}
      action="Xem đơn"
      empty="Yêu cầu mới sẽ xuất hiện ở đây khi khách đặt hoa trên website."
    />
  );
}
type PersonnelItem = {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  status: 'ACTIVE' | 'LOCKED' | 'DISABLED';
  role: string;
  createdAt: string;
};

function AdminPersonnelSummary({ session }: { session: Session }) {
  const query = useQuery({
    queryKey: ['dashboard-admin-managers', session.id],
    queryFn: () => request<PersonnelItem[]>('/admin/managers'),
    refetchInterval: 60_000,
  });

  const items = Array.isArray(query.data)
    ? query.data
    : Array.isArray((query.data as unknown as { items?: PersonnelItem[] })?.items)
      ? ((query.data as unknown as { items: PersonnelItem[] }).items ?? [])
      : [];
  const activeCount = items.filter((m) => m.status === 'ACTIVE').length;
  const lockedCount = items.filter((m) => m.status === 'LOCKED').length;
  const disabledCount = items.filter((m) => m.status === 'DISABLED').length;
  const totalCount = items.length;

  return (
    <section className="personnel-summary-card" aria-labelledby="admin-managers-summary-title">
      <div className="personnel-summary-header">
        <div>
          <p className="personnel-summary-eyebrow">Quản trị nhân sự</p>
          <h2 id="admin-managers-summary-title">Đội ngũ Quản lý vận hành</h2>
          <p>
            Nhân sự điều phối kỹ thuật viên, theo dõi sự cố và vận hành các điểm tủ hoa trên toàn hệ
            thống.
          </p>
        </div>
        <Link className="button button-primary" href="/admin/managers">
          Quản lý tài khoản <ArrowRight size={17} aria-hidden="true" />
        </Link>
      </div>

      {query.isPending ? (
        <p role="status" className="dashboard-placeholder">
          Đang tải thông tin đội ngũ quản lý vận hành…
        </p>
      ) : query.isError ? (
        <div className="dashboard-empty">
          <CircleAlert size={28} aria-hidden="true" />
          <p role="alert">
            Chưa tải được danh sách Quản lý vận hành. Dữ liệu lỗi không được tính là danh sách
            trống.
          </p>
          <Button
            variant="outline"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            Thử lại danh sách quản lý
          </Button>
        </div>
      ) : (
        <>
          <div className="personnel-summary-stats" aria-label="Thống kê nhân sự quản lý vận hành">
            <article className="personnel-summary-stat">
              <span>Tổng số tài khoản</span>
              <strong>{totalCount}</strong>
            </article>
            <article className="personnel-summary-stat">
              <span>Đang hoạt động</span>
              <strong style={{ color: 'var(--color-status-success-ink, #1b5e20)' }}>
                {activeCount}
              </strong>
            </article>
            <article className="personnel-summary-stat">
              <span>Tạm khóa / Vô hiệu hóa</span>
              <strong
                style={{
                  color:
                    lockedCount + disabledCount > 0
                      ? 'var(--color-status-danger-ink, #a8071a)'
                      : undefined,
                }}
              >
                {lockedCount + disabledCount}
              </strong>
            </article>
          </div>
          <div className="personnel-summary-actions">
            <Link href="/admin/managers">
              Mở danh sách quản lý vận hành <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <span className="dashboard-data-note">Dữ liệu thực từ hệ thống quản lý tài khoản</span>
          </div>
        </>
      )}
    </section>
  );
}

function SellerPersonnelSummary({ session }: { session: Session }) {
  const sellerId = session.sellerId;
  const query = useQuery({
    queryKey: ['dashboard-seller-staff', session.id, sellerId],
    queryFn: () => request<PersonnelItem[]>(`/sellers/${sellerId}/staff/accounts`),
    enabled: !!sellerId,
    refetchInterval: 60_000,
  });

  const items = Array.isArray(query.data)
    ? query.data
    : Array.isArray((query.data as unknown as { items?: PersonnelItem[] })?.items)
      ? ((query.data as unknown as { items: PersonnelItem[] }).items ?? [])
      : [];
  const activeCount = items.filter((s) => s.status === 'ACTIVE').length;
  const lockedCount = items.filter((s) => s.status === 'LOCKED').length;
  const disabledCount = items.filter((s) => s.status === 'DISABLED').length;
  const totalCount = items.length;

  return (
    <section className="personnel-summary-card" aria-labelledby="seller-staff-summary-title">
      <div className="personnel-summary-header">
        <div>
          <p className="personnel-summary-eyebrow">Vận hành shop</p>
          <h2 id="seller-staff-summary-title">Đội ngũ Nhân viên shop</h2>
          <p>Nhân sự thực hiện công việc giao hoa, kiểm tra tem bó hoa và nạp ô tủ cho shop.</p>
        </div>
        <Link className="button button-primary" href="/seller/staff">
          Quản lý nhân viên <ArrowRight size={17} aria-hidden="true" />
        </Link>
      </div>

      {query.isPending ? (
        <p role="status" className="dashboard-placeholder">
          Đang tải danh sách nhân viên shop…
        </p>
      ) : query.isError ? (
        <div className="dashboard-empty">
          <CircleAlert size={28} aria-hidden="true" />
          <p role="alert">
            Chưa tải được danh sách nhân viên shop. Dữ liệu lỗi không được tính là danh sách trống.
          </p>
          <Button
            variant="outline"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            Thử lại danh sách nhân viên
          </Button>
        </div>
      ) : (
        <>
          <div className="personnel-summary-stats" aria-label="Thống kê nhân sự nhân viên shop">
            <article className="personnel-summary-stat">
              <span>Tổng số nhân viên</span>
              <strong>{totalCount}</strong>
            </article>
            <article className="personnel-summary-stat">
              <span>Đang làm việc</span>
              <strong style={{ color: 'var(--color-status-success-ink, #1b5e20)' }}>
                {activeCount}
              </strong>
            </article>
            <article className="personnel-summary-stat">
              <span>Tạm khóa / Vô hiệu hóa</span>
              <strong
                style={{
                  color:
                    lockedCount + disabledCount > 0
                      ? 'var(--color-status-danger-ink, #a8071a)'
                      : undefined,
                }}
              >
                {lockedCount + disabledCount}
              </strong>
            </article>
          </div>
          <div className="personnel-summary-actions">
            <Link href="/seller/staff">
              Mở danh sách nhân viên shop <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <span className="dashboard-data-note">Dữ liệu thực từ hệ thống quản lý shop</span>
          </div>
        </>
      )}
    </section>
  );
}

function AdminOverview({ session }: { session: Session }) {
  const incidents = useQuery({
    queryKey: ['dashboard-incidents', session.id],
    queryFn: () =>
      readFeed<Incident>('/admin/incidents?status=OPEN&page=1', (row) => ({
        id: row.id,
        title: row.location?.kioskName || 'Sự cố tại tủ',
        detail: row.reason,
        state: 'Đang mở',
      })),
    refetchInterval: 60_000,
  });
  const reports = useQuery({
    queryKey: ['dashboard-reports', session.id],
    queryFn: () =>
      readFeed<Task>('/admin/staff-tasks?page=1&status=SUBMITTED', (row) => ({
        id: row.id,
        title: `${row.kind === 'INCIDENT' ? 'Kiểm tra sự cố' : 'Giao hoa'} · ${row.kioskName}`,
        detail: row.assigneeName,
        state: 'Chờ duyệt',
      })),
    refetchInterval: 60_000,
  });
  return (
    <div className="dashboard-overview">
      <WorkspaceWelcome workspaceRole="admin">
        <div className="dashboard-focus-chips" aria-label="Tóm tắt dữ liệu trong trang đầu">
          <span className="dashboard-focus-chip">
            Sự cố trong trang đầu:{' '}
            <strong>{incidents.data ? incidents.data.rows.length : '—'}</strong>
          </span>
          <span className="dashboard-focus-chip">
            Báo cáo trong trang đầu:{' '}
            <strong>{reports.data ? reports.data.rows.length : '—'}</strong>
          </span>
        </div>
      </WorkspaceWelcome>
      <AdminPersonnelSummary session={session} />
      <div className="dashboard-overview-grid">
        <FeedPanel
          title="Sự cố cần xử lý"
          query={incidents}
          href="/admin/incidents"
          action="Xem sự cố"
          empty="Không có sự cố đang mở trong danh sách hiện tại. Các báo cáo mới sẽ xuất hiện tại đây."
        />
        <FeedPanel
          title="Báo cáo chờ duyệt"
          query={reports}
          href="/admin/tasks"
          action="Xem báo cáo"
          empty="Nhân viên chưa có báo cáo đang chờ duyệt. Bạn có thể theo dõi tiến độ trong mục theo dõi công việc."
        />
      </div>
      <OrderFeed session={session} />
      <div className="dashboard-shortcuts" aria-label="Truy cập nhanh">
        <Link href="/admin/shops">
          Duyệt shop hoa <ArrowRight size={18} aria-hidden="true" />
        </Link>
        <Link href="/admin/refunds">
          Kiểm tra hoàn tiền <ArrowRight size={18} aria-hidden="true" />
        </Link>
        <Link href="/admin/withdrawals">
          Yêu cầu rút tiền <ArrowRight size={18} aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
function SellerOverview({ session }: { session: Session }) {
  const base = `/sellers/${session.sellerId}`;
  const products = useQuery({
    queryKey: ['dashboard-products', session.id, base],
    queryFn: async () => {
      const value = await request<components['schemas']['ProductResponse'][]>(`${base}/products`);
      if (!Array.isArray(value)) throw new Error('Invalid product response');
      return value;
    },
    refetchInterval: 60_000,
  });
  const wallet = useQuery({
    queryKey: ['dashboard-wallet', session.id, base],
    queryFn: () => request<components['schemas']['WalletResponse']>(`${base}/wallet`),
    refetchInterval: 60_000,
  });
  const orders = useQuery({
    queryKey: ['dashboard-seller-orders-count', session.id, base],
    queryFn: () => request<Page<WebOrder>>(`${base}/preorders?page=1`),
    refetchInterval: 60_000,
  });
  const queries = [products, wallet, orders];
  const busy = queries.some((q) => q.isFetching);

  const activeProducts = products.data
    ? products.data.filter((item) => item.status === 'ACTIVE').length
    : 0;
  const totalProducts = products.data ? products.data.length : 0;
  const pendingOrders = orders.data?.items?.length ?? 0;

  return (
    <div className="operations-overview">
      <section className="operations-welcome" aria-labelledby="seller-welcome-title">
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              flexWrap: 'wrap',
              marginBottom: '0.45rem',
            }}
          >
            <span className="operations-eyebrow" style={{ margin: 0 }}>
              KHÔNG GIAN CỬA HÀNG
            </span>
            {session.sellerStatus && (
              <span
                className="dashboard-focus-chip"
                style={{ minHeight: '26px', padding: '0.15rem 0.65rem', fontSize: '0.75rem' }}
              >
                Trạng thái shop:{' '}
                <strong>
                  {session.sellerStatus === 'ACTIVE'
                    ? 'Đang hoạt động'
                    : session.sellerStatus === 'PAST_DUE'
                      ? 'Quá hạn'
                      : 'Chờ kích hoạt'}
                </strong>
              </span>
            )}
          </div>
          <h2 id="seller-welcome-title">Mỗi bó hoa, một kết nối tròn vẹn.</h2>
          <p>Kiểm tra yêu cầu mới, chăm chút mẫu hoa và theo dõi dòng tiền bán hàng tại kiosk.</p>
          <Link className="button" href="/seller/products">
            Quản lý mẫu hoa <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </div>
        <div className="operations-welcome-aside" aria-hidden="true">
          <Store size={68} />
          <span>Mẫu hoa · Tủ kiosk · Dòng tiền</span>
        </div>
      </section>

      <div className="operations-section-heading">
        <div>
          <span className="operations-eyebrow">NHỊP BÁN HÀNG</span>
          <h2>Việc cần theo dõi</h2>
        </div>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => {
            queries.forEach((query) => void query.refetch());
          }}
        >
          <RefreshCw size={16} aria-hidden="true" className={busy ? 'spin' : ''} />
          {busy ? 'Đang cập nhật…' : 'Làm mới'}
        </Button>
      </div>

      <section className="operations-metrics" aria-label="Tình hình cửa hàng">
        <Link href="/seller/products" className="operations-metric">
          <Flower2 aria-hidden="true" />
          <span>Mẫu hoa đang bán</span>
          <strong>{products.isError ? '—' : products.isPending ? '…' : activeProducts}</strong>
          <small>
            {products.isError ? 'Chưa tải được mẫu' : `/ ${totalProducts} mẫu trong danh mục`}
          </small>
        </Link>
        <Link href="/seller/wallet" className="operations-metric">
          <Wallet aria-hidden="true" />
          <span>Tiền có thể rút</span>
          {wallet.isPending ? (
            <strong>…</strong>
          ) : wallet.isError ? (
            <>
              <strong>—</strong>
              <small>Chưa tải được số dư ví</small>
            </>
          ) : wallet.data?.balance ? (
            <>
              <strong className="dashboard-value">
                {money(wallet.data.balance.availableBalance)}
              </strong>
              <small>Đang chờ: {money(wallet.data.balance.pendingBalance)}</small>
            </>
          ) : (
            <p>Ví chưa có số dư được ghi nhận.</p>
          )}
        </Link>
        <Link href="/seller/orders" className="operations-metric">
          <ClipboardList aria-hidden="true" />
          <span>Đơn hoa chờ xử lý</span>
          <strong>{orders.isError ? '—' : orders.isPending ? '…' : pendingOrders}</strong>
          <small>{orders.isError ? 'Chưa tải được đơn hàng' : 'Yêu cầu khách đặt tại kiosk'}</small>
        </Link>
      </section>

      <div className="operations-overview-grid">
        <section className="operations-surface" aria-labelledby="seller-recent-title">
          <div className="operations-section-heading">
            <div>
              <h2 id="seller-recent-title">Yêu cầu đặt hoa gần đây</h2>
              <p>Tối đa 5 yêu cầu gần nhất, theo ngày nhận.</p>
            </div>
            <Link href="/seller/orders">
              Xem tất cả <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
          {orders.isPending && <p role="status">Đang tải đơn đặt hoa…</p>}
          {orders.isError && <p role="alert">Chưa tải được đơn đặt hoa. Hãy thử làm mới.</p>}
          {orders.data?.items.length === 0 && (
            <div className="operations-empty">
              <ClipboardList size={32} aria-hidden="true" />
              <h3>Chưa có yêu cầu đặt hoa</h3>
              <p>Yêu cầu mới sẽ xuất hiện ở đây khi khách đặt hoa trên website.</p>
            </div>
          )}
          <div className="operations-recent-list">
            {orders.data?.items.slice(0, 5).map((row) => (
              <Link key={row.id} href="/seller/orders">
                <span className="operations-list-icon">
                  <Flower2 size={20} aria-hidden="true" />
                </span>
                <span className="operations-recent-name">
                  <strong>{row.productName || row.orderCode || 'Yêu cầu đặt hoa'}</strong>
                  <small>
                    {row.kioskName || 'Tủ nhận'} · Hẹn nhận {date(row.pickupAt)}
                  </small>
                </span>
                <span
                  className="kiosk-status-pill order-status-pill"
                  data-status={row.orderStatus || row.state}
                >
                  {statusName(row)}
                </span>
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            ))}
          </div>
        </section>

        <section
          className="operations-surface operations-guide"
          id="operations-guide"
          aria-labelledby="operations-guide-title"
        >
          <span className="operations-eyebrow">QUY TRÌNH LÀM VIỆC</span>
          <h2 id="operations-guide-title">Từ đơn hàng đến nhận tiền</h2>
          <ol>
            <li>
              <strong>Đăng ký mẫu hoa</strong>
              <p>Khai báo kích thước, hình ảnh và gắn tem mã vạch trước khi nạp hoa.</p>
            </li>
            <li>
              <strong>Nạp hoa vào ô tủ</strong>
              <p>Chọn ô kiosk đang trống của shop và xác nhận nạp qua tem mã vạch.</p>
            </li>
            <li>
              <strong>Theo dõi &amp; Nhận tiền</strong>
              <p>Khách nhận hoa tại tủ, doanh thu tự động ghi nhận vào ví của shop.</p>
            </li>
          </ol>
          <Link href="/seller/stock">
            Kiểm tra ô hoa tại kiosk <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </section>
      </div>

      <SellerPersonnelSummary session={session} />

      <div className="dashboard-shortcuts" aria-label="Truy cập nhanh">
        <Link href="/seller/stock">
          Kiểm tra hoa tại tủ <ArrowRight size={18} aria-hidden="true" />
        </Link>
        <Link href="/seller/subscriptions">
          Gói thuê & gia hạn <ArrowRight size={18} aria-hidden="true" />
        </Link>
        <Link href="/tai-khoan">
          Đơn mua cá nhân <ArrowRight size={18} aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
export default function DashboardOverview({ session }: { session: Session }) {
  return session.role === 'ADMIN' ? (
    <AdminOverview session={session} />
  ) : (
    <SellerOverview session={session} />
  );
}
