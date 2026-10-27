'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Boxes, ClipboardList, RefreshCw, Users, Button } from '@florabot/ui';
import type { components } from '../../../packages/contracts/src/generated/api';
import { request, type Session } from './api';
import type { AccountDirectoryItem } from './AccountManagement';
import type { EligibleKioskResponse, KioskApplicationPage } from './kioskApplicationTypes';
import { KIOSK_STATUS_LABELS } from './kioskApplicationTypes';
import WorkspaceWelcome from './platform/WorkspaceWelcome';

export default function OperationsOverview({ session }: { session: Session }) {
  const enabled = session.role === 'OPERATIONS_MANAGER';
  const applications = useQuery({
    queryKey: ['operations-kiosk-applications', session.id, 'overview'],
    queryFn: () => request<KioskApplicationPage>('/operations/kiosk-applications?page=1&limit=5'),
    enabled,
  });
  const reports = useQuery({
    queryKey: ['staff-tasks', 'OPERATIONS_MANAGER', session.id, 'overview-submitted'],
    queryFn: () =>
      request<components['schemas']['StaffTaskPage']>(
        '/operations/staff-tasks?page=1&status=SUBMITTED',
      ),
    enabled,
  });
  const technicians = useQuery({
    queryKey: ['account-directory', 'TECHNICIAN', 'platform', '/operations/technicians'],
    queryFn: () => request<AccountDirectoryItem[]>('/operations/technicians'),
    enabled,
  });
  const kiosks = useQuery({
    queryKey: ['eligible-kiosks', session.id, 'overview'],
    queryFn: () => request<EligibleKioskResponse[]>('/operations/eligible-kiosks'),
    enabled,
  });
  const queries = [applications, reports, technicians, kiosks];
  const busy = queries.some((query) => query.isFetching);

  if (!enabled)
    return (
      <p role="status">
        Chế độ giám sát:{' '}
        <Link href="/operations/installations">Xem hồ sơ thuê và lắp đặt kiosk</Link>.
      </p>
    );

  return (
    <div className="operations-overview">
      <WorkspaceWelcome workspaceRole="operations" />

      <div className="operations-section-heading">
        <div>
          <span className="operations-eyebrow">NHỊP VẬN HÀNH</span>
          <h2>Việc cần theo dõi</h2>
        </div>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => {
            queries.forEach((query) => void query.refetch());
          }}
        >
          <RefreshCw size={16} aria-hidden="true" />
          {busy ? 'Đang cập nhật…' : 'Làm mới'}
        </Button>
      </div>
      <div className="operations-metrics">
        <Link href="/operations/tasks" className="operations-metric">
          <ClipboardList aria-hidden="true" />
          <span>Báo cáo chờ duyệt</span>
          <strong>
            {reports.isError
              ? '—'
              : reports.data
                ? `${reports.data.items.length}${reports.data.hasMore ? '+' : ''}`
                : '…'}
          </strong>
          <small>
            {reports.isError ? 'Chưa tải được công việc' : 'Công việc kỹ thuật · trang đầu'}
          </small>
        </Link>
        <Link href="/operations/technicians" className="operations-metric">
          <Users aria-hidden="true" />
          <span>Kỹ thuật viên hoạt động</span>
          <strong>
            {technicians.isError
              ? '—'
              : technicians.data
                ? technicians.data.filter((item) => item.status === 'ACTIVE').length
                : '…'}
          </strong>
          <small>Đội ngũ kỹ thuật trên nền tảng</small>
        </Link>
        <Link href="/operations/installations" className="operations-metric">
          <Boxes aria-hidden="true" />
          <span>Kiosk có thể phân bổ</span>
          <strong>{kiosks.isError ? '—' : (kiosks.data?.length ?? '…')}</strong>
          <small>Chưa gán shop · gồm cả tủ offline</small>
        </Link>
      </div>
      {queries.some((query) => query.isError) && (
        <p role="alert" className="operations-inline-error">
          Một số dữ liệu chưa tải được. Bấm Làm mới hoặc mở mục tương ứng để thử lại.
        </p>
      )}

      <div className="operations-overview-grid">
        <section className="operations-surface" aria-labelledby="operations-recent-title">
          <div className="operations-section-heading">
            <div>
              <h2 id="operations-recent-title">Hồ sơ mới nhất</h2>
              <p>Tối đa 5 hồ sơ gần nhất, theo ngày tiếp nhận.</p>
            </div>
            <Link href="/operations/installations">
              Xem tất cả <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
          {applications.isPending && <p role="status">Đang tải hồ sơ…</p>}
          {applications.isError && <p role="alert">Chưa tải được hồ sơ. Hãy thử làm mới.</p>}
          {applications.data?.items.length === 0 && (
            <div className="operations-empty">
              <ClipboardList size={32} aria-hidden="true" />
              <h3>Chưa có hồ sơ thuê kiosk</h3>
              <p>Hồ sơ khách gửi sẽ xuất hiện tại đây để bạn theo dõi.</p>
            </div>
          )}
          <div className="operations-recent-list">
            {applications.data?.items.map((item) => (
              <Link
                key={item.id}
                href={`/operations/installations?application=${encodeURIComponent(item.id)}`}
              >
                <span className="operations-list-icon">
                  <Boxes size={20} aria-hidden="true" />
                </span>
                <span className="operations-recent-name">
                  <strong>{item.shopName}</strong>
                  <small>
                    {item.packageName} · {new Date(item.createdAt).toLocaleDateString('vi-VN')}
                  </small>
                </span>
                <span className="kiosk-status-pill" data-status={item.status}>
                  {KIOSK_STATUS_LABELS[item.status] ?? item.status}
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
          <h2 id="operations-guide-title">Từ hồ sơ đến bàn giao</h2>
          <ol>
            <li>
              <strong>Xác nhận liên hệ</strong>
              <p>Kiểm tra địa chỉ, mặt bằng và điều kiện lắp đặt với khách.</p>
            </li>
            <li>
              <strong>Xếp lịch & phân công</strong>
              <p>Chọn kỹ thuật viên và kiosk đúng cấu hình gói thuê.</p>
            </li>
            <li>
              <strong>Nghiệm thu kết quả</strong>
              <p>Đọc báo cáo, xem ảnh minh chứng rồi xác nhận bàn giao.</p>
            </li>
          </ol>
          <Link href="/operations/tasks">
            Điều phối sự cố kỹ thuật <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </section>
      </div>
    </div>
  );
}
