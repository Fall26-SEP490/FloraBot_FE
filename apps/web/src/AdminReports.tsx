'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@florabot/ui';
import { request, type Session } from './api';

const reports = {
  v_admin_queue: {
    title: 'Hàng đợi vận hành',
    description: 'Các hàng đợi do backend tổng hợp từ dữ liệu hiện tại.',
    columns: [
      ['hang_cho', 'Hàng đợi'],
      ['so_luong', 'Số lượng'],
    ],
  },
  v_revenue_daily: {
    title: 'Giá trị đơn theo ngày',
    description:
      'GMV theo ngày và kiosk từ khoản thu thành công; không phải lợi nhuận hay phí nền tảng.',
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
    description:
      'Khảo sát và kết quả mua ghi nhận trong backend. Không đại diện cho kiểm thử Gemini hay IoT thật.',
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

export default function AdminReports({ session }: { session: Session }) {
  const [report, setReport] = useState<ReportName>('v_admin_queue');
  const [page, setPage] = useState(1);
  const config = reports[report];
  const query = useQuery({
    queryKey: ['admin-reports', session.id, report],
    queryFn: () => request<ReportRow[]>(`/admin/reports/${report}`),
    enabled: session.role === 'ADMIN',
  });
  if (session.role !== 'ADMIN') return null;
  const rows = query.data ?? [];
  const pageCount = Math.max(1, Math.ceil(rows.length / 20));
  return (
    <section className="api-reports" aria-labelledby="api-reports-title">
      <div className="reports-heading">
        <div>
          <p className="quiet">Dữ liệu từ hệ thống</p>
          <h2 id="api-reports-title">Báo cáo vận hành</h2>
          <p>
            Tra cứu dữ liệu thật từ API. Các báo cáo chỉ đọc, không tạo giao dịch hoặc điều khiển
            tủ.
          </p>
        </div>
        <Button variant="outline" disabled={query.isFetching} onClick={() => void query.refetch()}>
          {query.isFetching ? 'Đang cập nhật…' : 'Cập nhật báo cáo'}
        </Button>
      </div>
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
      <p>{config.description}</p>
      <p className="quiet">
        API trả tối đa 100 dòng mỗi báo cáo. Không suy ra tổng hệ thống từ các dòng đang hiển thị.
        Hàng đợi có thể bao gồm dữ liệu của mô hình cũ.
      </p>
      {query.isPending ? (
        <p role="status">Đang đọc báo cáo từ backend…</p>
      ) : query.isError ? (
        <p role="alert">Chưa tải được báo cáo. Kiểm tra kết nối rồi chọn cập nhật.</p>
      ) : !rows.length ? (
        <p role="status" className="reports-empty">
          Chưa có dữ liệu cho báo cáo này. Hệ thống chưa ghi nhận số liệu, không thay thế bằng dữ
          liệu mẫu.
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
                {config.title} · {rows.length} dòng API trả về
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
                    {config.columns.map(([key]) => (
                      <td key={key}>{displayValue(row[key])}</td>
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
    </section>
  );
}
