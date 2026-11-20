'use client';
import { liveListOptions } from '@/shared/lib/live-list';

/* eslint-disable jsx-a11y/no-noninteractive-tabindex -- Scrollable report regions need keyboard focus for horizontal scrolling. */

import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import type { components } from '../../../../../../packages/contracts/src/generated/api';
import { AdminFilterBar } from '@/features/portal/components/AdminUi';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@florabot/ui';
import { request, type Session } from '@/shared/lib/api';
import { isRevenueReport } from '../revenue-report.utils';
import './admin-revenue-report.css';
import './report-sheet.css';
import { loadAuditPages, matchesAuditSearch } from '../audit-search.utils';
import AdminSellerReports from './AdminSellerReports';
import AdminRevenueReport from './AdminRevenueReport';

const reports = {
  v_admin_queue: {
    title: 'Hàng đợi vận hành',
    description: 'Các yêu cầu đang chờ xử lý được tổng hợp từ dữ liệu hiện tại.',
    columns: [
      ['hang_cho', 'Hàng đợi'],
      ['so_luong', 'Số lượng'],
    ],
  },
  v_revenue_daily: {
    title: 'Thu và hoàn tiền bán hoa',
    description:
      'Tổng giá trị đơn đã thu tiền theo ngày và kiosk; không phải lợi nhuận hay phí nền tảng.',
    columns: [
      ['ngay', 'Ngày'],
      ['kiosk', 'Kiosk'],
      ['so_don', 'Số đơn'],
      ['gmv', 'Giá trị đơn (VND)'],
      ['giam_do_diem', 'Giảm bằng điểm (VND)'],
    ],
  },
  v_platform_revenue: {
    title: 'Doanh thu phí thuê',
    description:
      'Phí thuê ghi nhận trong sổ cái nền tảng theo tháng. Tách biệt với tiền bán hoa của shop.',
    columns: [
      ['thang', 'Tháng'],
      ['doanh_thu_phi_goi', 'Phí thuê (VND)'],
    ],
  },
  v_ai_effectiveness: {
    title: 'Hiệu quả tư vấn',
    description: 'Kết quả khảo sát, mua hàng và thời gian phản hồi được hệ thống ghi nhận.',
    columns: [
      ['kiosk_id', 'Kiosk'],
      ['source', 'Nguồn'],
      ['so_khao_sat', 'Khảo sát'],
      ['so_mua', 'Đã mua'],
      ['ty_le_mua', 'Tỷ lệ mua (%)'],
      ['latency_tb_ms', 'Độ trễ TB (ms)'],
    ],
  },
} as const;
type ReportName = keyof typeof reports;
type ReportRow = Record<string, unknown>;

function displayValue(value: unknown) {
  if (value == null) return '—';
  if (typeof value === 'number')
    return Number.isFinite(value) && (Number.isSafeInteger(value) || !Number.isInteger(value))
      ? value.toLocaleString('vi-VN', { maximumFractionDigits: 4 })
      : 'Giá trị vượt độ chính xác';
  if (typeof value === 'string') {
    if (/^-?\d+$/.test(value)) return BigInt(value).toLocaleString('vi-VN');
    return value;
  }
  return typeof value === 'boolean' ? (value ? 'Có' : 'Không') : '—';
}

type AuditLogPage = components['schemas']['AuditPage'];

const auditActions: Record<string, string> = {
  DEVICE_SENT: 'Gửi lệnh đến thiết bị',
  DEVICE_ACK: 'Thiết bị nhận lệnh',
  DEVICE_OPENED: 'Cửa đã mở',
  DEVICE_CLOSED: 'Cửa đã đóng',
  ORDER_STATUS_CHANGED: 'Đổi trạng thái đơn hàng',
  CHECKOUT_STARTED: 'Bắt đầu thanh toán',
  STAFF_TASK_ASSIGNED: 'Phân công công việc',
  STAFF_TASK_UPDATED: 'Cập nhật công việc',
  STAFF_TASK_EVIDENCE_ADDED: 'Thêm ảnh công việc',
  SLOT_MAINTENANCE_STARTED: 'Bắt đầu bảo trì ô tủ',
  SLOT_MAINTENANCE_COMPLETED: 'Kết thúc bảo trì ô tủ',
  DAILY_RECONCILIATION: 'Đối soát hằng ngày',
  PERSONAL_BANK_REVEALED: 'Xem thông tin ngân hàng',
  ESP32_CONFIG_DOWNLOADED: 'Tải cấu hình thiết bị',
  ESP32_CONFIG_VIEWED: 'Xem cấu hình thiết bị',
  WEB_REQUEST_CREATED: 'Tạo yêu cầu đặt hoa',
  WEB_REQUEST_QUOTED: 'Báo giá đặt hoa',
  WEB_QUOTE_ACCEPTED: 'Khách chấp nhận báo giá',
  WEB_ORDER_READY: 'Hoa đặt trước đã sẵn sàng',
  QUALITY_DEVICE_SENT: 'Gửi lệnh cửa khi đổi hoa',
  QUALITY_DEVICE_ACK: 'Thiết bị nhận lệnh đổi hoa',
  QUALITY_DEVICE_OPENED: 'Cửa đã mở khi đổi hoa',
  QUALITY_DEVICE_CLOSED: 'Cửa đã đóng khi đổi hoa',
  QUALITY_REPLACEMENT_COLLECTED: 'Khách đã nhận hoa đổi',
  QUALITY_REPLACEMENT_LOADED: 'Đã nạp hoa đổi',
  QUALITY_REPLACEMENT_PICKUP_REQUESTED: 'Yêu cầu nhận hoa đổi',
  QUALITY_COMPLAINT_REVIEWED: 'Duyệt kết quả phản ánh hoa',
  QUALITY_COMPLAINT_ACCEPTED: 'Chấp nhận phản ánh hoa',
  QUALITY_REPLACEMENT_PLANNED: 'Lên kế hoạch đổi hoa',
  QUALITY_TASK_ASSIGNED: 'Phân công đổi hoa',
  PREORDER_PICKUP_OTP_USED: 'Đã dùng mã nhận hoa',
  PREORDER_PICKUP_OTP_REQUESTED: 'Yêu cầu mã nhận hoa',
};
const auditEntities: Record<string, string> = {
  orders: 'Đơn hàng',
  slots: 'Ô tủ',
  kiosks: 'Kiosk',
  staff_tasks: 'Công việc',
  disputes: 'Phiếu phản ánh / sự cố',
  unlock_tokens: 'Lệnh mở cửa',
  web_requests: 'Yêu cầu đặt hoa',
  user_profiles: 'Hồ sơ tài khoản',
  payments: 'Giao dịch thanh toán',
  flower_products: 'Sản phẩm hoa',
  sellers: 'Shop hoa',
  subscriptions: 'Kỳ thuê kiosk',
};
function AdminAuditLogsSection({
  esp32Kiosk,
  actorId,
}: {
  esp32Kiosk: string | null;
  actorId: string;
}) {
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const actionFilter = esp32Kiosk ? 'ESP32_CONFIG_DOWNLOADED' : '';
  const entityTypeFilter = esp32Kiosk ? 'kiosks' : entityFilter;
  const entityIdFilter = esp32Kiosk ?? '';
  const [page, setPage] = useState(1);

  const searching = search.trim().length > 0;
  const serverPage = Math.floor((page - 1) / 5) + 1;
  const logs = useQuery({
    queryKey: [
      'admin-audit-logs',
      actorId,
      actionFilter,
      entityTypeFilter,
      entityIdFilter,
      searching ? 'all' : serverPage,
    ],
    queryFn: async ({ signal }) => {
      const fetchPage = (number: number) => {
        const params = new URLSearchParams({ page: String(number) });
        if (actionFilter) params.set('action', actionFilter);
        if (entityTypeFilter) params.set('entityType', entityTypeFilter);
        if (entityIdFilter) params.set('entityId', entityIdFilter);
        return request<AuditLogPage>(`/admin/audit-logs?${params}`);
      };
      if (!searching) return fetchPage(serverPage);
      const items = await loadAuditPages(fetchPage, signal);
      return { items, page: 1, hasMore: false };
    },
  });

  const visibleLogs = (logs.data?.items ?? []).filter((item) =>
    matchesAuditSearch(
      [
        item.action,
        auditActions[item.action] ?? '',
        item.entityType,
        auditEntities[item.entityType] ?? '',
        item.entityId ?? '',
        item.actorId ?? '',
        item.actorType === 'SYSTEM'
          ? 'Hệ thống'
          : item.actorType === 'USER'
            ? 'Tài khoản'
            : item.actorType,
        new Date(item.createdAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
      ],
      search,
    ),
  );
  const offset = searching ? (page - 1) * 10 : ((page - 1) % 5) * 10;
  const pageLogs = visibleLogs.slice(offset, offset + 10);
  const hasNext = offset + 10 < visibleLogs.length || (!searching && !!logs.data?.hasMore);
  const firstResult = (page - 1) * 10 + 1;
  return (
    <section className="admin-audit-panel" aria-label="Nhật ký hệ thống">
      <form
        className="admin-audit-search"
        onSubmit={(event) => {
          event.preventDefault();
          setSearch(searchDraft.trim());
          setPage(1);
        }}
      >
        <div className="audit-search-controls">
          {!esp32Kiosk && (
            <div>
              <label htmlFor="audit-entity-filter">Đối tượng</label>
              <select
                id="audit-entity-filter"
                value={entityFilter}
                onChange={(event) => {
                  setEntityFilter(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">Tất cả đối tượng</option>
                {Object.entries(auditEntities).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label htmlFor="audit-plain-search">Tìm nhật ký</label>
            <input
              id="audit-plain-search"
              type="search"
              maxLength={120}
              value={searchDraft}
              placeholder="Nhập hành động, đối tượng hoặc mã…"
              onChange={(event) => {
                setSearchDraft(event.target.value);
                if (!event.target.value.trim()) {
                  setSearch('');
                  setPage(1);
                }
              }}
            />
          </div>
          <Button type="submit">Tìm kiếm</Button>
          {(searchDraft || search || entityFilter) && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setSearchDraft('');
                setSearch('');
                setEntityFilter('');
                setPage(1);
              }}
            >
              Đặt lại
            </Button>
          )}
        </div>
      </form>
      {logs.isPending && (
        <p role="status">{searching ? 'Đang tìm trong toàn bộ nhật ký…' : 'Đang tải nhật ký…'}</p>
      )}
      {logs.isError && (
        <div role="alert">
          <p className="error">Chưa tải được nhật ký kiểm toán.</p>
          <Button variant="outline" disabled={logs.isFetching} onClick={() => void logs.refetch()}>
            {logs.isFetching ? 'Đang tải…' : 'Thử lại nhật ký'}
          </Button>
        </div>
      )}
      {logs.data && logs.data.items.length === 0 && (
        <p role="status">Chưa có nhật ký trong danh sách này.</p>
      )}
      {logs.data && logs.data.items.length > 0 && visibleLogs.length === 0 && (
        <p role="status">Không tìm thấy nhật ký phù hợp.</p>
      )}
      {logs.data && logs.data.items.length > 0 && (
        <>
          <div
            className="admin-report-sheet admin-audit-sheet"
            role="region"
            aria-label="Bảng nhật ký kiểm toán"
            tabIndex={0}
          >
            <table>
              <thead>
                <tr>
                  <th scope="col">Thời gian</th>
                  <th scope="col">Hành động</th>
                  <th scope="col">Đối tượng</th>
                  <th scope="col">Mã đối tượng</th>
                  <th scope="col">Người thực hiện</th>
                </tr>
              </thead>
              <tbody>
                {pageLogs.map((item) => (
                  <tr key={item.id}>
                    <td className="sheet-date">
                      <time dateTime={item.createdAt}>
                        <span>
                          {new Date(item.createdAt).toLocaleDateString('vi-VN', {
                            timeZone: 'Asia/Ho_Chi_Minh',
                          })}
                        </span>
                        <small>
                          {new Date(item.createdAt).toLocaleTimeString('vi-VN', {
                            timeZone: 'Asia/Ho_Chi_Minh',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </small>
                      </time>
                    </td>
                    <td>
                      <strong className="sheet-action" title={item.action}>
                        {auditActions[item.action] || item.action}
                      </strong>
                    </td>
                    <td title={item.entityType}>
                      {auditEntities[item.entityType] || item.entityType || '—'}
                    </td>
                    <td>
                      <code className="sheet-id">{item.entityId || '—'}</code>
                    </td>
                    <td>
                      {item.actorType === 'SYSTEM'
                        ? 'Hệ thống'
                        : item.actorType === 'USER'
                          ? 'Tài khoản'
                          : item.actorType}
                      {item.actorId && <code className="sheet-id">{item.actorId}</code>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <nav aria-label="Phân trang nhật ký kiểm toán" className="stock-actions">
            <Button
              type="button"
              variant="outline"
              disabled={page <= 1 || logs.isFetching}
              onClick={() => setPage((p) => p - 1)}
            >
              Trang trước
            </Button>
            <span role="status">
              {pageLogs.length ? `${firstResult}–${firstResult + pageLogs.length - 1}` : '0'}
              {searching ? ` / ${visibleLogs.length}` : ''} · Trang {page}
            </span>
            <Button
              type="button"
              variant="outline"
              disabled={!hasNext || logs.isFetching}
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

export default function AdminReports({ session }: { session: Session }) {
  const searchParams = useSearchParams();
  const esp32Kiosk = searchParams.get('esp32Kiosk');
  const [reportArea, setReportArea] = useState<'shops' | 'system' | 'audit'>(
    esp32Kiosk ? 'audit' : 'shops',
  );
  const [report, setReport] = useState<ReportName>('v_admin_queue');
  const [page, setPage] = useState(1);
  const [systemSearch, setSystemSearch] = useState('');
  const financial = isRevenueReport(report);
  const config = reports[report];
  const query = useQuery({
    ...liveListOptions(),
    queryKey: ['admin-reports', session.id, report],
    queryFn: async () => {
      const rows = await request<ReportRow[]>(`/admin/reports/${report}`);
      if (!Array.isArray(rows)) throw new Error('Không đọc được dữ liệu báo cáo.');
      return rows;
    },
    enabled: session.role === 'ADMIN' && reportArea === 'system' && !financial,
  });
  if (session.role !== 'ADMIN') return null;
  const rows = (query.data ?? []).filter((row) =>
    matchesAuditSearch(
      config.columns.map(([key]) => displayValue(row[key])),
      systemSearch,
    ),
  );
  const pageCount = Math.max(1, Math.ceil(rows.length / 20));
  return (
    <section className="api-reports" aria-label="Trung tâm báo cáo">
      <nav className="admin-report-area-nav" aria-label="Chọn nhóm báo cáo">
        {(
          [
            ['shops', 'Doanh số & thuê kiosk'],
            ['system', 'Số liệu hệ thống'],
            ['audit', 'Nhật ký hệ thống'],
          ] as const
        ).map(([value, title]) => (
          <button
            key={value}
            type="button"
            aria-pressed={reportArea === value}
            onClick={() => setReportArea(value)}
          >
            <strong>{title}</strong>
          </button>
        ))}
      </nav>
      <div hidden={reportArea !== 'shops'}>
        <AdminSellerReports
          actorId={session.id}
          initialSellerId={searchParams.get('sellerId') ?? ''}
        />
      </div>
      {reportArea === 'system' && (
        <div className="admin-report-area-panel">
          <h2>Số liệu hệ thống</h2>
          <AdminFilterBar
            label="Loại báo cáo"
            actions={
              !financial &&
              query.isError && (
                <Button
                  variant="outline"
                  disabled={query.isFetching}
                  onClick={() => void query.refetch()}
                >
                  {query.isFetching ? 'Đang cập nhật…' : 'Cập nhật báo cáo'}
                </Button>
              )
            }
          >
            <div>
              <label htmlFor="operations-report">Chọn báo cáo</label>
              <select
                id="operations-report"
                value={report}
                onChange={(event) => {
                  setReport(event.target.value as ReportName);
                  setPage(1);
                  setSystemSearch('');
                }}
              >
                {Object.entries(reports).map(([key, item]) => (
                  <option key={key} value={key}>
                    {item.title}
                  </option>
                ))}
              </select>
            </div>
          </AdminFilterBar>
          {financial ? (
            <AdminRevenueReport
              key={report}
              actorId={session.id}
              kind={report === 'v_platform_revenue' ? 'rental' : 'flowers'}
            />
          ) : (
            <>
              <div className="admin-audit-search">
                <label htmlFor="system-report-search">Tìm trong báo cáo</label>
                <input
                  id="system-report-search"
                  type="search"
                  value={systemSearch}
                  placeholder="Nhập nội dung cần tìm…"
                  onChange={(event) => {
                    setSystemSearch(event.target.value);
                    setPage(1);
                  }}
                />
              </div>
              {query.isPending ? (
                <p role="status">Đang tải báo cáo…</p>
              ) : query.isError ? (
                <p role="alert">Chưa tải được báo cáo. Kiểm tra kết nối rồi chọn cập nhật.</p>
              ) : !rows.length ? (
                <p role="status">Chưa có dữ liệu cho báo cáo này.</p>
              ) : (
                <>
                  <div
                    className="admin-report-sheet admin-system-sheet"
                    role="region"
                    aria-label={config.title}
                    tabIndex={0}
                  >
                    <table>
                      <caption>{config.title}</caption>
                      <thead>
                        <tr>
                          {config.columns.map(([key, label]) => (
                            <th scope="col" key={key}>
                              {label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.slice((page - 1) * 20, page * 20).map((row, index) => (
                          <tr key={`${page}-${index}`}>
                            {config.columns.map(([key, label]) => (
                              <td
                                key={key}
                                data-label={label}
                                className={
                                  typeof row[key] === 'number' ? 'sheet-number' : undefined
                                }
                              >
                                {displayValue(row[key])}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <nav aria-label="Phân trang báo cáo" className="stock-actions">
                    <Button
                      variant="outline"
                      disabled={page === 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      Trang trước
                    </Button>
                    <span>
                      Trang {page} / {pageCount}
                    </span>
                    <Button
                      variant="outline"
                      disabled={page >= pageCount}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Trang sau
                    </Button>
                  </nav>
                </>
              )}
            </>
          )}
        </div>
      )}
      {reportArea === 'audit' && (
        <div className="admin-report-area-panel">
          <AdminAuditLogsSection
            key={esp32Kiosk ?? 'all'}
            esp32Kiosk={esp32Kiosk}
            actorId={session.id}
          />
        </div>
      )}
    </section>
  );
}
