'use client';
import { liveListOptions } from '@/shared/lib/live-list';

/* eslint-disable jsx-a11y/no-noninteractive-tabindex -- Scrollable report regions need keyboard focus for horizontal scrolling. */

import Select from '@/shared/components/Select';
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
import styles from './operational-reports.module.css';
import { loadAuditPages, matchesAuditSearch } from '../audit-search.utils';
import AdminSellerReports from './AdminSellerReports';
import AdminRevenueReport from './AdminRevenueReport';

const reports = {
  v_admin_queue: {
    title: 'Việc đang chờ xử lý',
    columns: [
      ['hang_cho', 'Nội dung'],
      ['so_luong', 'Số lượng'],
    ],
  },
  v_revenue_daily: {
    title: 'Thu và hoàn tiền bán hoa',
    columns: [
      ['ngay', 'Ngày'],
      ['kiosk', 'Kiosk'],
      ['so_don', 'Số đơn'],
      ['gmv', 'Giá trị đơn (VND)'],
    ],
  },
  v_platform_revenue: {
    title: 'Doanh thu phí thuê',
    columns: [
      ['thang', 'Tháng'],
      ['doanh_thu_phi_goi', 'Phí thuê (VND)'],
    ],
  },
  v_ai_effectiveness: {
    title: 'Hiệu quả tư vấn',
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
  RECONCILED_DAILY: 'Đối soát nội bộ theo ngày',
  RECONCILED: 'Đối chiếu sao kê PayOS',
  SELLER_REFUND_TRANSFER_SUBMITTED: 'Shop gửi minh chứng hoàn tiền',
  SELLER_REFUND_BANK_VIEWED: 'Shop xem tài khoản nhận hoàn tiền',
  REFUND_INFO_SUBMITTED: 'Khách cung cấp tài khoản nhận hoàn tiền',
  REFUND_INFO_CLEARED: 'Xóa thông tin nhận hoàn tiền',
  REFUND_APPROVED: 'Duyệt hoàn tiền',
  REFUND_CONFIRMED: 'Xác nhận đã hoàn tiền',
  ACCESSORY_RESTOCKED: 'Nhập thêm phụ kiện',
  ADMIN_ACCOUNT_PROFILE_VIEWED: 'Xem hồ sơ tài khoản',
  CONTACT_EMAIL_VERIFIED: 'Xác minh email liên hệ',
  DEVICE_FAILED: 'Lệnh thiết bị thất bại',
  DEVICE_FAULT_REPORTED: 'Báo sự cố thiết bị',
  DEVICE_FAULT_RESOLVED: 'Đóng sự cố thiết bị',
  DISPENSE_FAILED: 'Giao hoa thất bại',
  DISPUTE_REFUND_APPROVED: 'Duyệt hoàn tiền khiếu nại',
  ESP32_PROVISIONING_QUEUED: 'Chờ cấu hình thiết bị',
  KIOSK_APPLICATION_CONFIRMED: 'Xác nhận hồ sơ thuê kiosk',
  KIOSK_APPLICATION_EVIDENCE_ATTACHED: 'Gắn ảnh hồ sơ thuê kiosk',
  KIOSK_APPLICATION_HANDOVER_COMPLETED: 'Hoàn tất bàn giao kiosk',
  KIOSK_APPLICATION_PAID: 'Thanh toán hồ sơ thuê kiosk',
  KIOSK_APPLICATION_SCHEDULED: 'Xếp lịch lắp đặt kiosk',
  KIOSK_ENROLLED: 'Đăng ký thiết bị kiosk',
  KIOSK_INSTALLATION_STARTED: 'Bắt đầu lắp đặt kiosk',
  KIOSK_INSTALLATION_SUBMITTED: 'Gửi báo cáo lắp đặt',
  KIOSK_KEY_PROVISIONED: 'Cấp khóa kết nối kiosk',
  KIOSK_MANAGER_AUTO_ASSIGNED: 'Tự động phân công quản lý kiosk',
  KIOSK_MANAGER_CHANGED: 'Đổi quản lý kiosk',
  KIOSK_RENEWAL_CANCELLED: 'Hủy gia hạn kiosk',
  KIOSK_RENEWAL_REQUESTED: 'Yêu cầu gia hạn kiosk',
  KIOSK_REQUIREMENTS_SUBMITTED: 'Gửi yêu cầu cấu hình kiosk',
  KIOSK_SLOT_PRICING_UPDATED: 'Cập nhật giá thuê ô tủ',
  PAYMENT_LINK_REQUESTED: 'Tạo liên kết thanh toán',
  PRODUCT_CREATED: 'Tạo mẫu hoa',
  PRODUCT_SHOP_QUANTITY_CHANGED: 'Cập nhật số lượng mẫu hoa',
  PRODUCT_STATUS_CHANGED: 'Đổi trạng thái mẫu hoa',
  PRODUCT_UPDATED: 'Cập nhật mẫu hoa',
  SELLER_PAYMENT_CHANNEL_STATUS_CHANGED: 'Đổi trạng thái kênh thanh toán shop',
  SELLER_SLOT_BOUQUET_REMOVED: 'Thu hồi hoa khỏi ô tủ',
  SLOT_MAINTENANCE_INSPECTION_OPENED: 'Mở kiểm tra phiên bảo trì',
  SLOT_MAINTENANCE_ISSUE_REPORTED: 'Báo sự cố khi bảo trì',
  SLOT_MANUAL_RETRY_ENROLLMENT_UPDATED: 'Cập nhật quyền thử lại ô tủ',
  SLOT_SENSOR_CAPABILITY_UPDATED: 'Cập nhật cấu hình cảm biến ô tủ',
  TECHNICAL_REPAIR_APPROVED: 'Duyệt ca sửa chữa',
  TECHNICAL_REPAIR_UNLOCK_ISSUED: 'Cấp mã mở ô sửa chữa',
  SUBSCRIPTION_REMINDER_QUEUED: 'Chờ gửi email nhắc gia hạn',
  SUBSCRIPTION_REMINDER_SENT: 'Đã gửi email nhắc gia hạn',
  SUBSCRIPTION_REMINDER_FAILED: 'Gửi email nhắc gia hạn thất bại',
  SUBSCRIPTION_REMINDER_SKIPPED: 'Bỏ qua email nhắc gia hạn',

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
  users: 'Tài khoản',
  accessories: 'Phụ kiện',
  kiosk_applications: 'Hồ sơ thuê kiosk',
  kiosk_slot_pricing: 'Giá thuê ô tủ',
  payment_channel_versions: 'Kênh thanh toán shop',
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

  const accounts = useQuery({
    queryKey: ['audit-account-names', actorId],
    staleTime: 300_000,
    queryFn: async () => {
      const names = new Map<string, { fullName: string; role: string }>();
      for (let number = 1; number <= 100; number++) {
        const result = await request<components['schemas']['AdminAccountPage']>(
          `/admin/accounts?page=${number}&pageSize=100`,
        );
        for (const account of result.items)
          names.set(account.id, { fullName: account.fullName, role: account.role });
        if (!result.hasMore) return names;
      }
      throw new Error('Chưa tải đủ tên tài khoản.');
    },
  });
  const actorRoles: Record<string, string> = {
    ADMIN: 'Quản trị viên',
    OPERATIONS_MANAGER: 'Quản lý vận hành',
    TECHNICIAN: 'Kỹ thuật viên',
    SELLER: 'Chủ shop',
    SELLER_STAFF: 'Nhân viên shop',
    CUSTOMER: 'Khách hàng',
    MEMBER: 'Khách hàng',
  };
  function actorLabel(item: AuditLogPage['items'][number]) {
    if (item.actorType === 'SYSTEM') return 'Hệ thống tự động';
    if (item.actorType === 'KIOSK') return 'Thiết bị kiosk';
    const account = item.actorId ? accounts.data?.get(item.actorId) : undefined;
    return (
      account?.fullName ||
      (item.actorType === 'USER'
        ? accounts.isPending
          ? 'Đang tải tên…'
          : 'Chưa xác định người dùng'
        : 'Chưa xác định')
    );
  }
  const visibleLogs = (logs.data?.items ?? []).filter((item) =>
    matchesAuditSearch(
      [
        item.action,
        auditActions[item.action] ?? '',
        item.entityType,
        auditEntities[item.entityType] ?? '',
        item.entityId ?? '',
        item.actorId ?? '',
        actorLabel(item),
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
              <Select
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
              </Select>
            </div>
          )}
          <div>
            <label htmlFor="audit-plain-search">Tìm nhật ký</label>
            <input
              id="audit-plain-search"
              type="search"
              maxLength={120}
              value={searchDraft}
              placeholder="Tìm thao tác, tên người thực hiện hoặc mã…"
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
      {accounts.isError && (
        <p className="quiet" role="status">
          Chưa tải được tên người thực hiện.
        </p>
      )}
      {logs.isPending && (
        <p role="status">{searching ? 'Đang tìm trong toàn bộ nhật ký…' : 'Đang tải nhật ký…'}</p>
      )}
      {logs.isError && (
        <div role="alert">
          <p className="error">Chưa tải được nhật ký.</p>
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
            className={`admin-report-sheet admin-audit-sheet ${styles.auditSheet}`}
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
                        {auditActions[item.action] || 'Hoạt động khác'}
                      </strong>
                    </td>
                    <td title={item.entityId ? `Mã tham chiếu: ${item.entityId}` : undefined}>
                      {auditEntities[item.entityType] || 'Đối tượng khác'}
                    </td>
                    <td>
                      <span title={item.actorId || undefined}>{actorLabel(item)}</span>
                      {item.actorType === 'USER' &&
                        item.actorId &&
                        accounts.data?.get(item.actorId) && (
                          <small className={styles.actorRole}>
                            {actorRoles[accounts.data.get(item.actorId)!.role] || 'Người dùng'}
                          </small>
                        )}
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
  const kiosks = useQuery({
    queryKey: ['admin-report-kiosks', session.id],
    queryFn: () => request<components['schemas']['AdminKioskResponse'][]>('/admin/kiosks'),
    enabled: session.role === 'ADMIN' && reportArea === 'system' && report === 'v_ai_effectiveness',
  });
  if (session.role !== 'ADMIN') return null;
  function cellValue(row: ReportRow, key: string) {
    if (key === 'hang_cho') {
      const labels: Record<string, string> = {
        'Seller chờ duyệt': 'Shop chờ duyệt',
        'Seller quá hạn gói': 'Shop quá hạn thuê',
        'Đơn đang nhả hàng': 'Đơn đang giao hoa',
        'Khiếu nại đang mở': 'Khiếu nại chưa hoàn tất',
        'Sự cố thiết bị đang mở': 'Sự cố thiết bị chưa hoàn tất',
        'Bó sắp hết hạn': 'Bó hoa sắp hết hạn',
      };
      return labels[String(row[key])] ?? displayValue(row[key]);
    }
    if (key === 'kiosk_id') {
      const kiosk = kiosks.data?.find((item) => item.id === row[key]);
      if (kiosk) return `${kiosk.code} · ${kiosk.name}`;
    }
    if (key === 'source') {
      const sources: Record<string, string> = {
        LLM: 'AI',
        FALLBACK: 'Dự phòng',
        CACHE: 'Kết quả có sẵn',
      };
      return sources[String(row[key])] ?? displayValue(row[key]);
    }
    return displayValue(row[key]);
  }
  const rows = (query.data ?? []).filter((row) =>
    matchesAuditSearch(
      config.columns.flatMap(([key]) => [displayValue(row[key]), cellValue(row, key)]),
      systemSearch,
    ),
  );
  const pageCount = Math.max(1, Math.ceil(rows.length / 20));
  const visiblePage = Math.min(page, pageCount);
  return (
    <section className={`api-reports ${styles.root}`} aria-label="Trung tâm báo cáo">
      <nav className="admin-report-area-nav" aria-label="Chọn nhóm báo cáo">
        {(
          [
            ['shops', 'Doanh số & thuê kiosk'],
            ['system', 'Tổng hợp hệ thống'],
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
        <div className={`admin-report-area-panel ${styles.panel}`}>
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
              <Select
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
              </Select>
            </div>
            {!financial && (
              <div>
                <label htmlFor="system-report-search">Tìm kiếm</label>
                <input
                  id="system-report-search"
                  type="search"
                  value={systemSearch}
                  placeholder="Tìm trong báo cáo…"
                  onChange={(event) => {
                    setSystemSearch(event.target.value);
                    setPage(1);
                  }}
                />
              </div>
            )}
          </AdminFilterBar>
          {financial ? (
            <AdminRevenueReport
              key={report}
              actorId={session.id}
              kind={report === 'v_platform_revenue' ? 'rental' : 'flowers'}
            />
          ) : (
            <>
              {query.isPending ? (
                <p role="status">Đang tải báo cáo…</p>
              ) : query.isError ? (
                <p role="alert">Chưa tải được báo cáo. Thử lại.</p>
              ) : !rows.length ? (
                <p role="status">
                  {systemSearch ? 'Không tìm thấy kết quả phù hợp.' : 'Chưa có dữ liệu.'}
                </p>
              ) : (
                <>
                  <div
                    className="admin-report-sheet admin-system-sheet"
                    role="region"
                    aria-label={config.title}
                    tabIndex={0}
                  >
                    <table>
                      <caption className="sr-only">{config.title}</caption>
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
                        {rows.slice((visiblePage - 1) * 20, visiblePage * 20).map((row, index) => (
                          <tr key={`${page}-${index}`}>
                            {config.columns.map(([key, label]) => (
                              <td
                                key={key}
                                data-label={label}
                                className={
                                  typeof row[key] === 'number' ? 'sheet-number' : undefined
                                }
                              >
                                {cellValue(row, key)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {(query.data?.length ?? 0) >= 100 && (
                    <p className="quiet">API trả về tối đa 100 dòng cho báo cáo này.</p>
                  )}
                  {pageCount > 1 && (
                    <nav aria-label="Phân trang báo cáo" className="stock-actions">
                      <Button
                        variant="outline"
                        disabled={visiblePage === 1}
                        onClick={() => setPage(visiblePage - 1)}
                      >
                        Trang trước
                      </Button>
                      <span>
                        Trang {visiblePage} / {pageCount}
                      </span>
                      <Button
                        variant="outline"
                        disabled={visiblePage >= pageCount}
                        onClick={() => setPage(visiblePage + 1)}
                      >
                        Trang sau
                      </Button>
                    </nav>
                  )}
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
