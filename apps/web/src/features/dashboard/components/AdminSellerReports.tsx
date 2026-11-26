import { liveListOptions } from '@/shared/lib/live-list';
import WorkspaceTable from '@/features/portal/components/WorkspaceTable';
/* eslint-disable jsx-a11y/no-noninteractive-tabindex -- The scrollable lease table supports keyboard navigation. */

import Select from '@/shared/components/Select';
import { useDeferredValue, useId, useState, type FocusEvent } from 'react';
import VietnamDateInput from '@/shared/components/VietnamDateInput';
import { useIsFetching, useQuery, useQueryClient } from '@tanstack/react-query';
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
import './report-sheet.css';
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

function LeaseDate({ value }: { value: string }) {
  const valueDate = new Date(value);
  return (
    <time
      dateTime={value}
      title={valueDate.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}
    >
      <span>
        {valueDate.toLocaleDateString('vi-VN', {
          timeZone: 'Asia/Ho_Chi_Minh',
          day: '2-digit',
          month: '2-digit',
        })}
      </span>
      <small>
        {valueDate.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric' })}
      </small>
    </time>
  );
}

function SellerReport({ actorId, seller }: { actorId: string; seller: Seller }) {
  const queryClient = useQueryClient();
  const ordersFetching =
    useIsFetching({
      queryKey: ['admin-seller-orders', actorId, seller.id],
    }) > 0;
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
    ...liveListOptions(),
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
    ...liveListOptions(),
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
    ...liveListOptions(),
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
    ...liveListOptions(),
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
        : tab === 'orders'
          ? ordersFetching
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
            if (
              filter?.from === period.from &&
              filter.to === period.to &&
              (tab === 'payments' || filter.kioskId === kioskId)
            ) {
              const key =
                tab === 'sales'
                  ? 'admin-seller-sales'
                  : tab === 'orders'
                    ? 'admin-seller-orders'
                    : 'admin-seller-payments';
              void queryClient.invalidateQueries({ queryKey: [key, actorId, seller.id] });
            }
            setFilter({
              ...period,
              kioskId,
              label:
                mode === 'month'
                  ? `Tháng ${month.slice(5)}/${month.slice(0, 4)}`
                  : `${date(from)} – ${date(to)}`,
            });
          }}
        >
          <div>
            <label htmlFor="seller-report-mode">Xem theo</label>
            <Select
              id="seller-report-mode"
              value={mode}
              onChange={(e) => setMode(e.target.value as 'month' | 'range')}
            >
              <option value="month">Tháng</option>
              <option value="range">Khoảng ngày</option>
            </Select>
          </div>
          {mode === 'month' ? (
            <div>
              <label htmlFor="seller-report-month">
                {tab === 'orders'
                  ? 'Tháng tạo đơn'
                  : tab === 'payments'
                    ? 'Tháng tạo giao dịch'
                    : 'Tháng thu / hoàn'}
              </label>
              <VietnamDateInput
                id="seller-report-month"
                kind="month"
                required
                value={month}
                onValueChange={setMonth}
              />
            </div>
          ) : (
            <>
              <div>
                <label htmlFor="seller-report-from">Từ ngày</label>
                <VietnamDateInput
                  id="seller-report-from"
                  label="Từ ngày"
                  required
                  max={to || undefined}
                  value={from}
                  onValueChange={setFrom}
                />
              </div>
              <div>
                <label htmlFor="seller-report-to">Đến ngày</label>
                <VietnamDateInput
                  id="seller-report-to"
                  label="Đến ngày"
                  required
                  min={from || undefined}
                  value={to}
                  onValueChange={setTo}
                />
              </div>
            </>
          )}
          {(tab === 'sales' || tab === 'orders') && (
            <div>
              <label htmlFor="seller-report-kiosk">Kiosk</label>
              <Select
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
              </Select>
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
      {(tab === 'sales' || tab === 'orders') && kiosks.isError && (
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
          {tab === 'sales' || tab === 'orders'
            ? ` · ${appliedKiosk?.code || (filter.kioskId ? filter.kioskId : 'Tất cả kiosk')}`
            : ''}
        </p>
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
              <WorkspaceTable label="Bảng báo cáo shop">
                <table>
                  <caption className="sr-only">Doanh số theo kiosk</caption>
                  <thead>
                    <tr>
                      <th>Kiosk</th>
                      <th>Đã thu trước hoàn</th>
                      <th>Đơn đã thanh toán</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sales.data.byKiosk.map((kiosk) => (
                      <tr key={kiosk.kioskId}>
                        <td>
                          {kiosk.kioskCode} · {kiosk.kioskName}
                        </td>
                        <td className="table-number">{money(kiosk.grossPaid)}</td>
                        <td className="table-number">{kiosk.orderCount.toLocaleString('vi-VN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </WorkspaceTable>
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
          <Select
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
          </Select>
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
              <WorkspaceTable label="Bảng báo cáo shop">
                <table>
                  <caption className="sr-only">Giao dịch thanh toán</caption>
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
                        <td className="table-number">{money(item.amount)}</td>
                        <td>
                          <span className="table-badge" data-state={item.status}>
                            {states[item.status] || item.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </WorkspaceTable>
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
              <div
                className="admin-report-sheet admin-lease-sheet"
                role="region"
                aria-label={`Lịch sử thuê kiosk của ${seller.shopName}`}
                tabIndex={0}
              >
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Kiosk / Gói thuê</th>
                      <th scope="col">Bắt đầu</th>
                      <th scope="col">Hết hạn</th>
                      <th scope="col" className="sheet-number">
                        Phí kỳ thuê
                      </th>
                      <th scope="col">Trạng thái</th>
                      <th scope="col">Email nhắc gia hạn</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leases.data.subscriptions.map((item) => {
                      const remaining = leaseDaysRemaining(item.expiresAt || item.periodTo);
                      const kiosk = kiosks.data?.find((k) => k.id === item.kioskId);
                      return (
                        <tr key={item.id}>
                          <td>
                            <strong>{item.kioskCode || kiosk?.code || 'Chưa có kiosk'}</strong>
                            <span className="lease-secondary">
                              {item.kioskName || kiosk?.name || item.kioskId || '—'}
                            </span>
                            <span
                              className="lease-secondary lease-package-name"
                              title={item.packageName}
                            >
                              {item.packageName}
                            </span>
                          </td>
                          <td className="sheet-date">
                            <LeaseDate value={item.periodFrom} />
                          </td>
                          <td className="sheet-date">
                            <LeaseDate value={item.expiresAt || item.periodTo} />
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
                          <td className="sheet-number">{money(item.price)}</td>
                          <td>
                            <span className="sheet-status" data-state={item.status}>
                              {states[item.status] || item.status}
                            </span>
                            {item.terminationReason && (
                              <span className="lease-secondary">{item.terminationReason}</span>
                            )}
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
                                )[item.reminderStatus] || 'Chưa rõ kết quả gửi'
                              : item.status !== 'ACTIVE'
                                ? '—'
                                : remaining !== null && remaining > 7
                                  ? 'Chưa đến kỳ nhắc'
                                  : 'Chưa ghi nhận gửi'}
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
                  Trang trước
                </Button>
                <span>Trang {leasePage}</span>
                <Button
                  variant="outline"
                  disabled={!leases.data.hasMore || leases.isFetching}
                  onClick={() => setLeasePage((value) => value + 1)}
                >
                  Trang sau
                </Button>
              </nav>
              {!leases.data.subscriptions.length && (
                <p>Shop chưa có kỳ thuê kiosk được ghi nhận.</p>
              )}
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
  const sellerSearch = useDeferredValue(searchDraft.trim());
  const [selectedSeller, setSelectedSeller] = useState<Seller | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [activeOption, setActiveOption] = useState(-1);
  const pickerId = useId();
  const sellers = useQuery({
    queryKey: ['admin-report-sellers', actorId, sellerSearch],
    queryFn: () =>
      request<Seller[]>(
        `/admin/sellers${sellerSearch ? `?search=${encodeURIComponent(sellerSearch)}` : ''}`,
      ),
  });
  const selected = selectedSeller ?? sellers.data?.find((seller) => seller.id === sellerId);
  const handlePickerBlur = (event: FocusEvent<HTMLElement>) => {
    if (!event.currentTarget.closest('.admin-shop-picker')?.contains(event.relatedTarget))
      setPickerOpen(false);
  };
  const chooseSeller = (seller: Seller) => {
    setSellerId(seller.id);
    setSelectedSeller(seller);
    setSearchDraft(seller.shopName);
    setPickerOpen(false);
    setActiveOption(-1);
  };
  return (
    <section className="admin-seller-reports" aria-labelledby="admin-seller-reports-title">
      <h2 id="admin-seller-reports-title">Doanh số & kỳ thuê theo shop</h2>
      <div className="admin-shop-picker" role="group" aria-label="Chọn shop báo cáo">
        <label htmlFor="admin-report-shop-search">Shop cần xem</label>
        <input
          id="admin-report-shop-search"
          type="search"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={pickerOpen}
          aria-controls={pickerId}
          aria-activedescendant={
            pickerOpen && activeOption >= 0 ? `${pickerId}-${activeOption}` : undefined
          }
          placeholder="Tìm hoặc chọn shop…"
          maxLength={100}
          value={searchDraft || (sellerId && selected ? selected.shopName : '')}
          onFocus={() => setPickerOpen(true)}
          onBlur={handlePickerBlur}
          onChange={(event) => {
            setSearchDraft(event.target.value);
            setSellerId('');
            setSelectedSeller(null);
            setPickerOpen(true);
            setActiveOption(-1);
          }}
          onKeyDown={(event) => {
            const count = sellers.data?.length ?? 0;
            if (event.key === 'Escape') {
              setPickerOpen(false);
              setActiveOption(-1);
            }
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault();
              setPickerOpen(true);
              if (count)
                setActiveOption((index) =>
                  event.key === 'ArrowDown'
                    ? Math.min(count - 1, index + 1)
                    : Math.max(0, index - 1),
                );
            }
            if (
              event.key === 'Enter' &&
              pickerOpen &&
              activeOption >= 0 &&
              sellers.data?.[activeOption]
            ) {
              event.preventDefault();
              chooseSeller(sellers.data[activeOption]);
            }
          }}
        />
        {pickerOpen && (
          <div
            id={pickerId}
            role="listbox"
            aria-label="Shop phù hợp"
            className="admin-shop-picker-results"
          >
            {sellers.data?.map((seller, index) => (
              <div key={seller.id} role="presentation">
                <button
                  type="button"
                  role="option"
                  id={`${pickerId}-${index}`}
                  aria-selected={index === activeOption}
                  onClick={() => chooseSeller(seller)}
                  onBlur={handlePickerBlur}
                >
                  <strong>{seller.shopName}</strong>
                  {seller.phone && <span>{seller.phone}</span>}
                </button>
              </div>
            ))}
            {!sellers.isFetching && sellers.isSuccess && !sellers.data.length && (
              <div role="presentation">Không tìm thấy shop.</div>
            )}
          </div>
        )}
      </div>
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
