import { liveListOptions } from '@/shared/lib/live-list';
import Select from '@/shared/components/Select';
import { useState } from 'react';
import VietnamDateInput from '@/shared/components/VietnamDateInput';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@florabot/ui';
import { request } from '@/shared/lib/api';
import { revenueInteger } from '../revenue-report.utils';
import { vietnamToday } from '../seller-report.utils';
import WorkspaceTable from '@/features/portal/components/WorkspaceTable';

type RevenueRow = {
  day: string;
  kioskId: string | null;
  kiosk: string | null;
  sellerId: string | null;
  grossPaid: string;
  totalRefunded: string;
  netReceipts: string;
  rentalRevenue: string;
  paidOrders: number;
};
type RevenuePage = {
  items: RevenueRow[];
  totals: RevenueRow;
  totalCount: number;
  page: number;
  pageSize: number;
};
const money = (value: unknown) => `${revenueInteger(value)?.toLocaleString('vi-VN') ?? '—'} đ`;

export default function AdminRevenueReport({
  kind,
  actorId,
}: {
  kind: 'flowers' | 'rental';
  actorId: string;
}) {
  const today = vietnamToday();
  const [from, setFrom] = useState(`${today.slice(0, 7)}-01`);
  const [to, setTo] = useState(today);
  const [seller, setSeller] = useState('');
  const [sellerSearch, setSellerSearch] = useState('');
  const [sellerPage, setSellerPage] = useState(1);
  const [selectedSeller, setSelectedSeller] = useState<{ id: string; shopName: string } | null>(
    null,
  );
  const [kiosk, setKiosk] = useState('');
  const [filter, setFilter] = useState({
    from: `${today.slice(0, 7)}-01`,
    to: today,
    seller: '',
    kiosk: '',
  });
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const params = new URLSearchParams({
    from: filter.from,
    to: filter.to,
    page: String(page),
    pageSize: '20',
  });
  if (filter.seller) params.set('sellerId', filter.seller);
  if (filter.kiosk) params.set('kioskId', filter.kiosk);
  const query = useQuery({
    ...liveListOptions(),
    queryKey: ['admin-revenue-period', actorId, kind, filter, page],
    queryFn: () => request<RevenuePage>(`/admin/revenue/${kind}?${params}`),
  });
  const kiosks = useQuery({
    ...liveListOptions(),
    queryKey: ['revenue-history-kiosks', actorId, seller],
    queryFn: () =>
      request<{ id: string; code: string; name: string }[]>(
        `/admin/sellers/${seller}/report-kiosks`,
      ),
    enabled: kind === 'flowers' && !!seller,
  });
  const sellers = useQuery({
    queryKey: ['revenue-sellers', actorId, sellerSearch, sellerPage],
    queryFn: () =>
      request<{ id: string; shopName: string }[]>(
        `/admin/sellers?${new URLSearchParams({ search: sellerSearch, page: String(sellerPage) })}`,
      ),
    enabled: kind === 'flowers',
  });
  const fields =
    kind === 'rental'
      ? ([['rentalRevenue', 'Phí thuê ghi sổ']] as const)
      : ([
          ['grossPaid', 'Thực thu'],
          ['totalRefunded', 'Đã hoàn'],
          ['netReceipts', 'Thu sau hoàn'],
        ] as const);
  return (
    <section aria-label="Báo cáo toàn kỳ">
      <form
        className="admin-revenue-filters"
        onSubmit={(event) => {
          event.preventDefault();
          if (!from || !to || from > to) {
            setError('Chọn khoảng ngày hợp lệ.');
            return;
          }
          setError('');
          setPage(1);
          const next = {
            from,
            to,
            seller: kind === 'flowers' ? seller : '',
            kiosk: kind === 'flowers' ? kiosk : '',
          };
          if (page === 1 && JSON.stringify(next) === JSON.stringify(filter)) void query.refetch();
          else setFilter(next);
        }}
      >
        <div>
          <label htmlFor="period-revenue-from">Từ ngày</label>
          <VietnamDateInput
            id="period-revenue-from"
            label="Từ ngày"
            required
            value={from}
            onValueChange={setFrom}
          />
        </div>
        <div>
          <label htmlFor="period-revenue-to">Đến ngày</label>
          <VietnamDateInput
            id="period-revenue-to"
            label="Đến ngày"
            required
            value={to}
            onValueChange={setTo}
          />
        </div>
        {kind === 'flowers' && (
          <>
            <div>
              <label htmlFor="period-revenue-seller-search">Tìm shop theo tên</label>
              <input
                id="period-revenue-seller-search"
                type="search"
                maxLength={100}
                value={sellerSearch}
                onChange={(e) => {
                  setSellerSearch(e.target.value);
                  setSellerPage(1);
                }}
              />
              <label htmlFor="period-revenue-seller">Shop</label>
              <Select
                id="period-revenue-seller"
                value={seller}
                onChange={(e) => {
                  setSeller(e.target.value);
                  setSelectedSeller(
                    sellers.data?.find((s) => s.id === e.target.value) ??
                      (selectedSeller?.id === e.target.value ? selectedSeller : null),
                  );
                  setKiosk('');
                }}
              >
                <option value="">Tất cả shop</option>
                {selectedSeller && !sellers.data?.some((s) => s.id === selectedSeller.id) && (
                  <option value={selectedSeller.id}>{selectedSeller.shopName}</option>
                )}
                {sellers.data?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.shopName}
                  </option>
                ))}
              </Select>
              <nav aria-label="Phân trang danh sách shop">
                <Button
                  type="button"
                  variant="outline"
                  disabled={sellerPage <= 1 || sellers.isFetching}
                  onClick={() => setSellerPage((p) => p - 1)}
                >
                  Shop trước
                </Button>
                <span role="status">
                  {sellers.isFetching ? 'Đang tìm shop…' : `Trang shop ${sellerPage}`}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  disabled={sellers.isFetching || !sellers.data || sellers.data.length < 25}
                  onClick={() => setSellerPage((p) => p + 1)}
                >
                  Shop tiếp
                </Button>
              </nav>
              {sellers.isSuccess && !sellers.data.length && (
                <p role="status">Không có shop trong trang tìm kiếm này.</p>
              )}
            </div>
            <div>
              <label htmlFor="period-revenue-kiosk">Kiosk</label>
              <Select
                id="period-revenue-kiosk"
                value={kiosk}
                disabled={!seller || kiosks.isPending || kiosks.isError}
                onChange={(e) => setKiosk(e.target.value)}
              >
                <option value="">Tất cả kiosk của shop</option>
                {kiosks.data?.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.code} — {k.name}
                  </option>
                ))}
              </Select>
            </div>
          </>
        )}
        <Button type="submit" disabled={query.isFetching}>
          {query.isFetching ? 'Đang tải…' : 'Xem báo cáo'}
        </Button>
      </form>
      {error && <p role="alert">{error}</p>}
      {sellers.isError && (
        <p role="alert">
          Chưa tải được danh sách shop.{' '}
          <Button variant="outline" onClick={() => void sellers.refetch()}>
            Thử lại
          </Button>
        </p>
      )}
      {seller && kiosks.isError && (
        <p role="alert">
          Chưa tải được kiosk lịch sử.{' '}
          <Button variant="outline" onClick={() => void kiosks.refetch()}>
            Thử lại
          </Button>
        </p>
      )}
      {query.isPending ? (
        <p role="status">Đang tải báo cáo…</p>
      ) : query.isError ? (
        <p role="alert">
          Không tải được báo cáo. <Button onClick={() => void query.refetch()}>Thử lại</Button>
        </p>
      ) : (
        <>
          <section className="admin-revenue-summary" aria-label="Tổng toàn kỳ">
            <h3>Tổng toàn kỳ</h3>
            <p className="admin-revenue-applied-period">
              {filter.from.split('-').reverse().join('/')} –{' '}
              {filter.to.split('-').reverse().join('/')}
            </p>
            <dl>
              {fields.map(([key, label]) => (
                <div key={key}>
                  <dt>{label}</dt>
                  <dd>{money(query.data.totals[key])}</dd>
                </div>
              ))}
              {kind === 'flowers' && (
                <div>
                  <dt>Đơn đã thanh toán</dt>
                  <dd>{query.data.totals.paidOrders}</dd>
                </div>
              )}
            </dl>
          </section>
          <WorkspaceTable label="Chi tiết doanh thu toàn kỳ">
            <table>
              <caption>{query.data.totalCount} dòng trong kỳ đã lọc</caption>
              <thead>
                <tr>
                  <th>Ngày</th>
                  {kind === 'flowers' && (
                    <>
                      <th>Kiosk</th>
                      <th>Shop</th>
                    </>
                  )}
                  {fields.map(([key, label]) => (
                    <th key={key}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {query.data.items.map((row) => (
                  <tr key={`${row.day}:${row.kioskId}:${row.sellerId}`}>
                    <td>
                      <time dateTime={row.day}>
                        {new Date(`${row.day}T00:00:00+07:00`).toLocaleDateString('vi-VN', {
                          timeZone: 'Asia/Ho_Chi_Minh',
                        })}
                      </time>
                    </td>
                    {kind === 'flowers' && (
                      <>
                        <td>{row.kiosk}</td>
                        <td>
                          {(selectedSeller?.id === row.sellerId ? selectedSeller.shopName : null) ||
                            sellers.data?.find((s) => s.id === row.sellerId)?.shopName ||
                            row.sellerId}
                        </td>
                      </>
                    )}
                    {fields.map(([key]) => (
                      <td key={key} className="table-number">
                        {money(row[key])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </WorkspaceTable>
          {!query.data.items.length && <p role="status">Không có giao dịch trong kỳ đã chọn.</p>}
          <nav className="stock-actions" aria-label="Phân trang báo cáo toàn kỳ">
            <Button
              variant="outline"
              disabled={page <= 1 || query.isFetching}
              onClick={() => setPage((p) => p - 1)}
            >
              Trang trước
            </Button>
            <span>
              Trang {page} / {Math.max(1, Math.ceil(query.data.totalCount / query.data.pageSize))}
            </span>
            <Button
              variant="outline"
              disabled={page * query.data.pageSize >= query.data.totalCount || query.isFetching}
              onClick={() => setPage((p) => p + 1)}
            >
              Trang sau
            </Button>
          </nav>
        </>
      )}
    </section>
  );
}
