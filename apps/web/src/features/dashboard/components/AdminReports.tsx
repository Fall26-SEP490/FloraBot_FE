'use client';

import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { AdminFilterBar } from '@/features/portal/components/AdminUi';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@florabot/ui';
import { request, type Session } from '@/shared/lib/api';

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
    title: 'Giá trị đơn theo ngày',
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

interface AuditLogEntry {
  id: string;
  actorType: string;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  createdAt: string;
  payloadRedacted: string;
}

interface AuditLogPage {
  items: AuditLogEntry[];
  page: number;
  hasMore: boolean;
}

function AdminAuditLogsSection({
  esp32Kiosk,
  actorId,
}: {
  esp32Kiosk: string | null;
  actorId: string;
}) {
  const [open, setOpen] = useState(Boolean(esp32Kiosk));
  const [actionFilter, setActionFilter] = useState(esp32Kiosk ? 'ESP32_CONFIG_DOWNLOADED' : '');
  const [entityTypeFilter, setEntityTypeFilter] = useState(esp32Kiosk ? 'kiosks' : '');
  const [entityIdFilter, setEntityIdFilter] = useState(esp32Kiosk ?? '');
  const [actorIdFilter, setActorIdFilter] = useState('');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const logs = useQuery({
    queryKey: [
      'admin-audit-logs',
      actorId,
      actionFilter.trim(),
      entityTypeFilter.trim(),
      entityIdFilter.trim(),
      actorIdFilter.trim(),
      page,
    ],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page) });
      if (actionFilter.trim()) params.set('action', actionFilter.trim());
      if (entityTypeFilter.trim()) params.set('entityType', entityTypeFilter.trim());
      if (entityIdFilter.trim()) params.set('entityId', entityIdFilter.trim());
      if (actorIdFilter.trim()) params.set('actorId', actorIdFilter.trim());
      return request<AuditLogPage>(`/admin/audit-logs?${params.toString()}`);
    },
    enabled: open,
  });

  const detail = useQuery({
    queryKey: ['admin-audit-log-detail', actorId, selectedId],
    queryFn: () => request<AuditLogEntry>(`/admin/audit-logs/${selectedId}`),
    enabled: open && Boolean(selectedId),
  });

  return (
    <details
      className="shop-profile"
      style={{ marginTop: '1.5rem' }}
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary>
        <strong>Nhật ký kiểm toán hệ thống (Audit Logs)</strong>
      </summary>
      {open && (
        <div style={{ marginTop: '0.75rem' }}>
          <AdminFilterBar label="Bộ lọc nhật ký kiểm toán">
            <div>
              <label htmlFor="audit-action-filter">Hành động (action)</label>
              <input
                id="audit-action-filter"
                value={actionFilter}
                onChange={(e) => {
                  setActionFilter(e.target.value);
                  setPage(1);
                }}
                placeholder="Ví dụ: ASSIGN_KIOSK…"
              />
            </div>
            <div>
              <label htmlFor="audit-entity-type">Loại thực thể (entityType)</label>
              <input
                id="audit-entity-type"
                value={entityTypeFilter}
                onChange={(e) => {
                  setEntityTypeFilter(e.target.value);
                  setPage(1);
                }}
                placeholder="Ví dụ: kiosk, order…"
              />
            </div>
            <div>
              <label htmlFor="audit-entity-id">Mã thực thể (entityId)</label>
              <input
                id="audit-entity-id"
                value={entityIdFilter}
                onChange={(e) => {
                  setEntityIdFilter(e.target.value);
                  setPage(1);
                }}
                placeholder="UUID thực thể…"
              />
            </div>
            <div>
              <label htmlFor="audit-actor-id">Mã tác nhân (actorId)</label>
              <input
                id="audit-actor-id"
                value={actorIdFilter}
                onChange={(e) => {
                  setActorIdFilter(e.target.value);
                  setPage(1);
                }}
                placeholder="UUID người thực hiện…"
              />
            </div>
          </AdminFilterBar>

          {logs.isPending && <p role="status">Đang tải nhật ký kiểm toán…</p>}
          {logs.isError && (
            <p role="alert" className="error">
              Chưa tải được nhật ký kiểm toán.
            </p>
          )}
          {logs.data && logs.data.items.length === 0 && (
            <p role="status">Không có bản ghi nhật ký kiểm toán khớp bộ lọc.</p>
          )}
          {logs.data && logs.data.items.length > 0 && (
            <>
              <ul className="admin-shop-list">
                {logs.data.items.map((item) => (
                  <li key={item.id} className="shop-profile">
                    <p>
                      <strong>{item.action}</strong> · {item.entityType}
                      {item.entityId ? ` (${item.entityId})` : ''}
                    </p>
                    <p className="quiet">
                      Tác nhân: {item.actorType} {item.actorId || ''} ·{' '}
                      {new Date(item.createdAt).toLocaleString('vi-VN')}
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setSelectedId(selectedId === item.id ? null : item.id)}
                    >
                      {selectedId === item.id ? 'Ẩn chi tiết' : 'Xem chi tiết'}
                    </Button>
                    {selectedId === item.id && detail.data && (
                      <pre
                        style={{
                          marginTop: '0.5rem',
                          padding: '0.5rem',
                          overflowX: 'auto',
                          fontSize: '0.8rem',
                        }}
                      >
                        {detail.data.payloadRedacted}
                      </pre>
                    )}
                  </li>
                ))}
              </ul>
              <nav aria-label="Phân trang nhật ký kiểm toán" className="stock-actions">
                <Button
                  type="button"
                  variant="outline"
                  disabled={page <= 1 || logs.isFetching}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Trang trước
                </Button>
                <span>Trang {page}</span>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!logs.data.hasMore || logs.isFetching}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Trang sau
                </Button>
              </nav>
            </>
          )}
        </div>
      )}
    </details>
  );
}

export default function AdminReports({ session }: { session: Session }) {
  const esp32Kiosk = useSearchParams().get('esp32Kiosk');
  const [report, setReport] = useState<ReportName>('v_admin_queue');
  const [page, setPage] = useState(1);
  const config = reports[report];
  const query = useQuery({
    queryKey: ['admin-reports', session.id, report],
    queryFn: async () => {
      const rows = await request<ReportRow[]>(`/admin/reports/${report}`);
      if (!Array.isArray(rows)) throw new Error('Không đọc được dữ liệu báo cáo.');
      return rows;
    },
    enabled: session.role === 'ADMIN',
  });
  if (session.role !== 'ADMIN') return null;
  const rows = query.data ?? [];
  const pageCount = Math.max(1, Math.ceil(rows.length / 20));
  return (
    <section className="api-reports" aria-labelledby="api-reports-title">
      <h2 id="api-reports-title">Tra cứu số liệu</h2>
      <AdminFilterBar
        label="Loại báo cáo"
        actions={
          <Button
            variant="outline"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            {query.isFetching ? 'Đang cập nhật…' : 'Cập nhật báo cáo'}
          </Button>
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
      <p>{config.description}</p>
      <p className="quiet">
        Hiển thị tối đa 100 dòng. Một số hàng đợi có cả hồ sơ từ quy trình thuê kiosk cũ.
      </p>
      {query.isPending ? (
        <p role="status">Đang tải báo cáo…</p>
      ) : query.isError ? (
        <p role="alert">Chưa tải được báo cáo. Kiểm tra kết nối rồi chọn cập nhật.</p>
      ) : !rows.length ? (
        <p role="status" className="reports-empty">
          Chưa có dữ liệu cho báo cáo này. Chọn báo cáo khác hoặc cập nhật để kiểm tra lại.
        </p>
      ) : (
        <>
          <div
            className="reports-table-wrap"
            // A horizontal scroll region needs a tab stop for keyboard scrolling.
            // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
            tabIndex={0}
            role="region"
            aria-label={`Bảng ${config.title}`}
          >
            <table>
              <caption>
                {config.title} · {rows.length} dòng dữ liệu
              </caption>
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
                      <td key={key} data-label={label}>
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
              onClick={() => setPage((value) => value - 1)}
            >
              Trang trước
            </Button>
            <span>
              Trang {page} / {pageCount}
            </span>
            <Button
              variant="outline"
              disabled={page >= pageCount}
              onClick={() => setPage((value) => value + 1)}
            >
              Trang sau
            </Button>
          </nav>
        </>
      )}
      <AdminAuditLogsSection
        key={esp32Kiosk ?? 'all'}
        esp32Kiosk={esp32Kiosk}
        actorId={session.id}
      />
    </section>
  );
}
