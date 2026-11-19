import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@florabot/ui';
import type { components } from '../../../../../../packages/contracts/src/generated/api';
import { request } from '@/shared/lib/api';
import { revenueInteger } from '../revenue-report.utils';
import {
  leaseDaysRemaining,
  sellerReportPeriod,
  vietnamToday,
  type ReportPeriod,
} from '../seller-report.utils';
import './admin-seller-reports.css';
import AdminSellerOrders from './AdminSellerOrders';

type Seller = components['schemas']['AdminSellerResponse'];
type Kiosk = { id: string; code: string; name: string };
type Sales = components['schemas']['SellerSalesReportResponse'];
type Payments = components['schemas']['SellerPaymentsListResponse'];
type Leases = components['schemas']['SubscriptionOverviewResponse'];
type Filter = ReportPeriod & { kioskId: string; label: string };
const money = (value: number | string) => {
  const integer = revenueInteger(value);
  return integer === null ? 'Chưa đọc được số tiền' : `${integer.toLocaleString('vi-VN')} đ`;
};
const date = (value: string) =>
  new Date(value.length === 10 ? `${value}T00:00:00+07:00` : value).toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    ...(value.length === 10
      ? { dateStyle: 'short' as const }
      : { dateStyle: 'short' as const, timeStyle: 'short' as const }),
  });
const states: Record<string, string> = {
  ACTIVE: 'Đang hiệu lực',
  EXPIRED: 'Hết hạn',
  PENDING_PAYMENT: 'Chờ thanh toán',
  CANCELLED: 'Đã hủy',
  TERMINATED: 'Đã chấm dứt',
  PAST_DUE: 'Quá hạn',
  SUCCEEDED: 'Thành công',
  PENDING: 'Đang chờ',
  FAILED: 'Thất bại',
};

function SellerReport({ actorId, seller }: { actorId: string; seller: Seller }) {
  const today = vietnamToday();
  const [tab, setTab] = useState<'sales' | 'payments' | 'orders' | 'leases'>('sales');
  const [mode, setMode] = useState<'month' | 'range'>('month');
  const [month, setMonth] = useState(today.slice(0, 7));
  const [from, setFrom] = useState(`${today.slice(0, 7)}-01`);
  const [to, setTo] = useState(today);
  const [kioskId, setKioskId] = useState('');
  const [filter, setFilter] = useState<Filter | null>(null);
  const [error, setError] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [page, setPage] = useState(1);
  const [leasePage, setLeasePage] = useState(1);
  const kiosks = useQuery({
    queryKey: ['admin-seller-report-kiosks', actorId, seller.id],
    queryFn: () => request<Kiosk[]>(`/admin/sellers/${seller.id}/report-kiosks`),
  });
  const currentKiosks = kiosks.data ?? [];
  const params = new URLSearchParams(
    filter
      ? { from: filter.from, to: filter.to, ...(filter.kioskId ? { kioskId: filter.kioskId } : {}) }
      : {},
  );
  const sales = useQuery({
    queryKey: ['admin-seller-sales', actorId, seller.id, filter],
    queryFn: () => request<Sales>(`/sellers/${seller.id}/reports/sales?${params}`),
    enabled: tab === 'sales' && !!filter,
  });
  const paymentParams = new URLSearchParams({
    from: filter?.from ?? '',
    to: filter?.to ?? '',
    page: String(page),
    pageSize: '20',
    ...(paymentStatus ? { status: paymentStatus } : {}),
  });
  const payments = useQuery({
    queryKey: [
      'admin-seller-payments',
      actorId,
      seller.id,
      filter?.from,
      filter?.to,
      paymentStatus,
      page,
    ],
    queryFn: () => request<Payments>(`/sellers/${seller.id}/payments?${paymentParams}`),
    enabled: tab === 'payments' && !!filter,
  });
  const leases = useQuery({
    queryKey: ['admin-seller-leases', actorId, seller.id, leasePage],
    queryFn: () => request<Leases>(`/sellers/${seller.id}/subscriptions?page=${leasePage}`),
    enabled: tab === 'leases',
  });
  const appliedKiosk = filter?.kioskId
    ? kiosks.data?.find((item) => item.id === filter.kioskId)
    : null;
  const busy =
    tab === 'sales'
      ? sales.isFetching
      : tab === 'payments'
        ? payments.isFetching
        : leases.isFetching;
  return (
    <section className="admin-seller-report-detail" aria-label={`Báo cáo ${seller.shopName}`}>
      <h3>{seller.shopName}</h3>
      <nav className="admin-seller-report-tabs" aria-label="Nội dung báo cáo seller">
        {(
          [
            ['sales', 'Doanh số bán hoa'],
            ['payments', 'Giao dịch thanh toán'],
            ['orders', 'Đơn mua / hủy'],
            ['leases', 'Lịch sử thuê & kỳ hạn'],
          ] as const
        ).map(([value, label]) => (
          <button
            type="button"
            key={value}
            aria-pressed={tab === value}
            onClick={() => setTab(value)}
          >
            {label}
          </button>
        ))}
      </nav>
      {tab !== 'leases' && (
        <form
          className="admin-revenue-filters"
          onSubmit={(event) => {
            event.preventDefault();
            const period = sellerReportPeriod(mode, month, from, to);
            if (!period) {
              setError('Chọn kỳ hợp lệ; ngày bắt đầu phải trước hoặc bằng ngày kết thúc.');
              return;
            }
            setError('');
            setPage(1);
            setFilter({
              ...period,
              kioskId,
              label: mode === 'month' ? `Tháng ${month}` : `${date(from)} – ${date(to)}`,
            });
          }}
        >
          <div>
            <label htmlFor="seller-report-mode">Xem theo</label>
            <select
              id="seller-report-mode"
              value={mode}
              onChange={(e) => setMode(e.target.value as 'month' | 'range')}
            >
              <option value="month">Tháng</option>
              <option value="range">Khoảng ngày</option>
            </select>
          </div>
          {mode === 'month' ? (
            <div>
              <label htmlFor="seller-report-month">Tháng báo cáo</label>
              <input
                id="seller-report-month"
                type="month"
                required
                value={month}
                onChange={(e) => setMonth(e.target.value)}
              />
            </div>
          ) : (
            <>
              <div>
                <label htmlFor="seller-report-from">Từ ngày</label>
                <input
                  id="seller-report-from"
                  type="date"
                  required
                  max={to || undefined}
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="seller-report-to">Đến ngày</label>
                <input
                  id="seller-report-to"
                  type="date"
                  required
                  min={from || undefined}
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </div>
            </>
          )}
          {(tab === 'sales' || tab === 'orders') && (
            <div>
              <label htmlFor="seller-report-kiosk">Kiosk</label>
              <select
                id="seller-report-kiosk"
                value={kioskId}
                onChange={(e) => setKioskId(e.target.value)}
                disabled={kiosks.isPending || kiosks.isError}
              >
                <option value="">Tất cả kiosk của shop</option>
                {currentKiosks.map((kiosk) => (
                  <option key={kiosk.id} value={kiosk.id}>
                    {kiosk.code} · {kiosk.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <Button type="submit" disabled={busy}>
            {busy ? 'Đang tải…' : 'Xem báo cáo'}
          </Button>
        </form>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {kiosks.isError && (
        <p role="alert">
          Chưa đọc được tên kiosk.{' '}
          <Button variant="outline" onClick={() => void kiosks.refetch()}>
            Thử tải kiosk
          </Button>
        </p>
      )}
      {tab !== 'leases' && filter && (
        <p className="quiet">
          Kỳ đang xem: {filter.label} · Giờ Việt Nam
          {tab === 'sales'
            ? ` · ${appliedKiosk?.code || (filter.kioskId ? filter.kioskId : 'Tất cả kiosk')}`
            : ''}
        </p>
      )}
      {tab !== 'leases' && !filter && (
        <p role="status">Chọn tháng hoặc khoảng ngày rồi bấm Xem báo cáo.</p>
      )}
      {tab === 'sales' && filter && (
        <>
          {sales.isPending ? (
            <p role="status">Đang tải doanh số…</p>
          ) : sales.isError ? (
            <div role="alert">
              <p>Chưa tải được doanh số: {sales.error.message}</p>
              <Button
                variant="outline"
                disabled={sales.isFetching}
                onClick={() => void sales.refetch()}
              >
                Thử lại doanh số
              </Button>
            </div>
          ) : (
            <>
              <dl className="admin-seller-report-metrics">
                {(
                  [
                    ['grossPaid', 'Đã thu trước hoàn'],
                    ['totalRefunded', 'Đã hoàn tiền'],
                    ['netReceipts', 'Thu sau hoàn'],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key}>
                    <dt>{label}</dt>
                    <dd>{money(sales.data[key])}</dd>
                  </div>
                ))}
                <div>
                  <dt>Đơn đã thanh toán</dt>
                  <dd>{sales.data.paidOrders.toLocaleString('vi-VN')}</dd>
                </div>
              </dl>
              <p className="quiet">
                Số thu sau hoàn không phải lợi nhuận. Tiền bán hoa thuộc shop, tách biệt phí thuê
                kiosk.
              </p>
              <div className="reports-table-wrap">
                <table>
                  <caption>Doanh số theo kiosk trong kỳ đã chọn</caption>
                  <thead>
                    <tr>
                      <th>Kiosk</th>
                      <th>Đã thu trước hoàn</th>
                      <th>Số đơn theo báo cáo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sales.data.byKiosk.map((kiosk) => (
                      <tr key={kiosk.kioskId}>
                        <td>
                          {kiosk.kioskCode} · {kiosk.kioskName}
                        </td>
                        <td>{money(kiosk.grossPaid)}</td>
                        <td>{kiosk.orderCount.toLocaleString('vi-VN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!sales.data.byKiosk.length && <p>Không có dữ liệu kiosk trong kỳ này.</p>}
            </>
          )}
        </>
      )}
      {tab === 'orders' && filter && (
        <AdminSellerOrders
          key={`${seller.id}:${filter.from}:${filter.to}:${filter.kioskId}`}
          actorId={actorId}
          sellerId={seller.id}
          from={filter.from}
          to={filter.to}
          kioskId={filter.kioskId}
        />
      )}
      {tab === 'payments' && filter && (
        <>
          <label htmlFor="seller-report-payment-state">Trạng thái thanh toán</label>
          <select
            id="seller-report-payment-state"
            value={paymentStatus}
            onChange={(e) => {
              setPaymentStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Tất cả</option>
            {['SUCCEEDED', 'PENDING', 'CANCELLED', 'FAILED', 'EXPIRED'].map((status) => (
              <option key={status} value={status}>
                {states[status] || status}
              </option>
            ))}
          </select>
          <p className="quiet">
            Giao dịch được lọc theo ngày tạo. Trạng thái thanh toán khác trạng thái mua/hủy của đơn
            hàng.
          </p>
          {payments.isPending ? (
            <p role="status">Đang tải giao dịch…</p>
          ) : payments.isError ? (
            <div role="alert">
              <p>Chưa tải được giao dịch: {payments.error.message}</p>
              <Button
                variant="outline"
                disabled={payments.isFetching}
                onClick={() => void payments.refetch()}
              >
                Thử lại giao dịch
              </Button>
            </div>
          ) : (
            <>
              <div className="reports-table-wrap">
                <table>
                  <caption>
                    Giao dịch của shop · Trang {page} · Tổng {payments.data.totalCount}
                  </caption>
                  <thead>
                    <tr>
                      <th>Mã giao dịch</th>
                      <th>Ngày tạo / Ngày thu</th>
                      <th>Số tiền</th>
                      <th>Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.data.payments.map((item) => (
                      <tr key={item.id}>
                        <td>{item.orderCode ?? item.id}</td>
                        <td>
                          {date(item.createdAt)}
                          <br />
                          {item.paidAt ? date(item.paidAt) : 'Chưa ghi nhận thu tiền'}
                        </td>
                        <td>{money(item.amount)}</td>
                        <td>{states[item.status] || item.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!payments.data.payments.length && <p>Không có giao dịch khớp bộ lọc.</p>}
              <nav className="stock-actions" aria-label="Phân trang giao dịch seller">
                <Button
                  variant="outline"
                  disabled={page === 1 || payments.isFetching}
                  onClick={() => setPage((value) => value - 1)}
                >
                  Trang trước
                </Button>
                <span>Trang {page}</span>
                <Button
                  variant="outline"
                  disabled={page * 20 >= Number(payments.data.totalCount) || payments.isFetching}
                  onClick={() => setPage((value) => value + 1)}
                >
                  Trang sau
                </Button>
              </nav>
            </>
          )}
        </>
      )}
      {tab === 'leases' && (
        <>
          <p>
            Lịch sử từng kỳ thuê gắn với kiosk. Ngày kết thúc là mốc hết hiệu lực; không dùng hạn
            tổng của shop để thay hạn của từng tủ.
          </p>
          {leases.isPending ? (
            <p role="status">Đang tải lịch sử thuê…</p>
          ) : leases.isError ? (
            <div role="alert">
              <p>Chưa tải được lịch sử thuê: {leases.error.message}</p>
              <Button
                variant="outline"
                disabled={leases.isFetching}
                onClick={() => void leases.refetch()}
              >
                Thử lại lịch sử thuê
              </Button>
            </div>
          ) : (
            <>
              <p className="quiet">Trang lịch sử thuê {leasePage}</p>
              <div className="reports-table-wrap">
                <table>
                  <caption>Lịch sử thuê kiosk của {seller.shopName}</caption>
                  <thead>
                    <tr>
                      <th>Gói / Kiosk</th>
                      <th>Thời hạn</th>
                      <th>Phí kỳ thuê</th>
                      <th>Trạng thái</th>
                      <th>Cảnh báo trước hạn</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leases.data.subscriptions.map((item) => {
                      const remaining = leaseDaysRemaining(item.expiresAt || item.periodTo);
                      const kiosk = kiosks.data?.find((k) => k.id === item.kioskId);
                      return (
                        <tr key={item.id}>
                          <td>
                            {item.packageName}
                            <br />
                            {item.kioskCode
                              ? `${item.kioskCode} · ${item.kioskName || ''}`
                              : kiosk
                                ? `${kiosk.code} · ${kiosk.name}`
                                : item.kioskId || 'Chưa có kiosk'}
                          </td>
                          <td>
                            {date(item.periodFrom)} – {date(item.expiresAt || item.periodTo)}
                            {item.status === 'ACTIVE' &&
                              remaining !== null &&
                              remaining >= 0 &&
                              remaining <= 7 && (
                                <strong className="admin-lease-due">
                                  {remaining === 0
                                    ? 'Đến hạn hôm nay'
                                    : `Còn ${remaining} ngày đến hạn`}
                                </strong>
                              )}
                          </td>
                          <td>{money(item.price)}</td>
                          <td>
                            {states[item.status] || item.status}
                            {item.terminationReason && <p>{item.terminationReason}</p>}
                          </td>
                          <td>
                            {item.reminderStatus
                              ? (
                                  {
                                    SUBSCRIPTION_REMINDER_QUEUED: 'Đang chờ gửi',
                                    SUBSCRIPTION_REMINDER_SENT: 'Đã gửi',
                                    SUBSCRIPTION_REMINDER_FAILED: 'Gửi thất bại',
                                    SUBSCRIPTION_REMINDER_SKIPPED: 'Đã bỏ qua',
                                  } as Record<string, string>
                                )[item.reminderStatus] || item.reminderStatus
                              : 'Chưa có ghi nhận gửi'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <nav className="stock-actions" aria-label="Phân trang lịch sử thuê">
                <Button
                  variant="outline"
                  disabled={leasePage === 1 || leases.isFetching}
                  onClick={() => setLeasePage((value) => value - 1)}
                >
                  Kỳ thuê trang trước
                </Button>
                <span>Trang {leasePage}</span>
                <Button
                  variant="outline"
                  disabled={!leases.data.hasMore || leases.isFetching}
                  onClick={() => setLeasePage((value) => value + 1)}
                >
                  Kỳ thuê trang sau
                </Button>
              </nav>
              {!leases.data.subscriptions.length && (
                <p>Shop chưa có kỳ thuê kiosk được ghi nhận.</p>
              )}
              <p className="quiet">
                Nhãn sắp hết hạn giúp theo dõi tại đây; không đồng nghĩa thông báo đã được gửi cho
                shop.
              </p>
            </>
          )}
        </>
      )}
    </section>
  );
}

export default function AdminSellerReports({
  actorId,
  initialSellerId = '',
}: {
  actorId: string;
  initialSellerId?: string;
}) {
  const [sellerId, setSellerId] = useState(initialSellerId);
  const [searchDraft, setSearchDraft] = useState('');
  const [sellerSearch, setSellerSearch] = useState('');
  const sellers = useQuery({
    queryKey: ['admin-report-sellers', actorId, sellerSearch],
    queryFn: () =>
      request<Seller[]>(
        `/admin/sellers${sellerSearch ? `?search=${encodeURIComponent(sellerSearch)}` : ''}`,
      ),
  });
  const selected = sellers.data?.find((seller) => seller.id === sellerId);
  return (
    <section className="admin-seller-reports" aria-labelledby="admin-seller-reports-title">
      <h2 id="admin-seller-reports-title">Doanh số & kỳ thuê theo shop</h2>
      <p>Chọn một shop để xem doanh số, giao dịch và lịch sử thuê kiosk.</p>
      <form
        className="admin-revenue-filters"
        onSubmit={(e) => {
          e.preventDefault();
          setSellerSearch(searchDraft.trim());
          setSellerId('');
        }}
      >
        <div>
          <label htmlFor="admin-report-shop-search">Tìm shop trên hệ thống</label>
          <input
            id="admin-report-shop-search"
            type="search"
            maxLength={100}
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
          />
        </div>
        <Button type="submit" variant="outline" disabled={sellers.isFetching}>
          Tìm shop
        </Button>
      </form>
      <label htmlFor="admin-report-seller">Shop cần xem</label>
      <select
        id="admin-report-seller"
        value={sellerId}
        onChange={(e) => setSellerId(e.target.value)}
        disabled={sellers.isPending || sellers.isError}
      >
        <option value="">Chọn shop</option>
        {sellers.data?.map((seller) => (
          <option key={seller.id} value={seller.id}>
            {seller.shopName}
          </option>
        ))}
      </select>
      {sellers.isPending && <p role="status">Đang tải danh sách shop…</p>}
      {sellers.isError && (
        <div role="alert">
          <p>Chưa tải được shop.</p>
          <Button variant="outline" onClick={() => void sellers.refetch()}>
            Thử lại danh sách shop
          </Button>
        </div>
      )}
      {(sellers.data?.length ?? 0) >= 100 && (
        <p className="quiet">Danh sách hiện gồm tối đa 100 shop mới nhất.</p>
      )}
      {sellerId && sellers.isSuccess && !selected && (
        <p role="status">Shop này không nằm trong danh sách đã tải. Chọn shop khác để tiếp tục.</p>
      )}
      {selected && (
        <SellerReport key={`${actorId}:${selected.id}`} actorId={actorId} seller={selected} />
      )}
    </section>
  );
}
