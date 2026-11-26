import ReportPeriodPicker from './ReportPeriodPicker';
import reportStyles from './revenue-summary.module.css';
import filterStyles from './revenue-filters.module.css';
import ReportPagination from './ReportPagination';
import RevenueShopPicker from './RevenueShopPicker';
import { liveListOptions } from '@/shared/lib/live-list';
import Select from '@/shared/components/Select';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@florabot/ui';
import { request } from '@/shared/lib/api';
import { revenueInteger } from '../revenue-report.utils';
import { sellerReportPeriod, vietnamToday } from '../seller-report.utils';
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
  const [periodMode, setPeriodMode] = useState<'month' | 'range'>('range');
  const [month, setMonth] = useState(today.slice(0, 7));
  const [from, setFrom] = useState(`${today.slice(0, 7)}-01`);
  const [to, setTo] = useState(today);
  const [seller, setSeller] = useState('');
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
  const shopNames = useQuery({
    queryKey: ['admin-report-sellers', actorId, ''],
    queryFn: () => request<{ id: string; shopName: string }[]>('/admin/sellers'),
    enabled: kind === 'flowers',
  });
  const fields =
    kind === 'rental'
      ? ([['rentalRevenue', 'Phí thuê ghi sổ']] as const)
      : ([
          ['grossPaid', 'Tổng doanh số'],
          ['totalRefunded', 'Đã hoàn'],
          ['netReceipts', 'Thu sau hoàn'],
        ] as const);
  return (
    <section aria-label="Báo cáo toàn kỳ">
      <form
        className={`admin-revenue-filters ${filterStyles.filters}`}
        onSubmit={(event) => {
          event.preventDefault();
          const period = sellerReportPeriod(periodMode, month, from, to);
          if (!period) {
            setError('Chọn khoảng ngày hợp lệ.');
            return;
          }
          setError('');
          setPage(1);
          const next = {
            from: period.from.slice(0, 10),
            to: period.to.slice(0, 10),
            seller: kind === 'flowers' ? seller : '',
            kiosk: kind === 'flowers' ? kiosk : '',
          };
          if (page === 1 && JSON.stringify(next) === JSON.stringify(filter)) void query.refetch();
          else setFilter(next);
        }}
      >
        <ReportPeriodPicker
          value={{ mode: periodMode, month, from, to }}
          onChange={(period) => {
            setPeriodMode(period.mode);
            setMonth(period.month);
            setFrom(period.from);
            setTo(period.to);
            setError('');
          }}
        />
        {kind === 'flowers' && (
          <div className={filterStyles.shops}>
            <RevenueShopPicker
              actorId={actorId}
              value={selectedSeller}
              onChange={(shop) => {
                setSelectedSeller(shop);
                setSeller(shop?.id ?? '');
                setKiosk('');
              }}
            />
            <div>
              <label htmlFor="period-revenue-kiosk">Kiosk</label>
              <Select
                id="period-revenue-kiosk"
                value={kiosk}
                disabled={!seller || kiosks.isPending || kiosks.isError}
                onChange={(e) => setKiosk(e.target.value)}
              >
                <option value="">{seller ? 'Tất cả kiosk của shop' : 'Chọn shop trước'}</option>
                {kiosks.data?.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.code} — {k.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        )}
        <div className={filterStyles.actions}>
          <Button type="submit" disabled={query.isFetching}>
            {query.isFetching ? 'Đang tải…' : 'Xem báo cáo'}
          </Button>
        </div>
      </form>
      {error && <p role="alert">{error}</p>}
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
          <section className={reportStyles.summary} aria-label="Tổng toàn kỳ">
            <header className={reportStyles.heading}>
              <h3>Tổng toàn kỳ</h3>
            </header>
            <dl data-kind={kind}>
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
                    <th key={key} className="table-number">
                      {label}
                    </th>
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
                            shopNames.data?.find((s) => s.id === row.sellerId)?.shopName ||
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
          <ReportPagination
            ariaLabel="Phân trang báo cáo doanh thu"
            page={page}
            totalPages={Math.max(1, Math.ceil(query.data.totalCount / query.data.pageSize))}
            busy={query.isFetching}
            onPageChange={setPage}
          />
        </>
      )}
    </section>
  );
}
