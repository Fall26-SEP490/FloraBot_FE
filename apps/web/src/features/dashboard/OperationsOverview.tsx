'use client';

import Link from 'next/link';
import { useQueries, useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  RefreshCw,
  Button,
  Store,
  Clock,
  CheckCircle2,
  Users,
  Boxes,
} from '@florabot/ui';
import type { components } from '../../../../../packages/contracts/src/generated/api';
import { request, type Session } from '@/shared/lib/api';
import type { AccountDirectoryItem } from '../account-management/account-management.types';
import type {
  EligibleKioskResponse,
  KioskApplicationPage,
} from '../installations/installations.types';
import { KIOSK_STATUS_LABELS } from '../installations/installations.constants';
import { managerApplicationAction } from '../installations/operations-presentation';
import { readOperationsCount } from './operations-queue';

const stages = [
  { status: 'PAID_REVIEW', label: 'Chờ xác nhận', hint: 'Liên hệ chủ shop' },
  { status: 'CONFIRMED', label: 'Chờ xếp lịch', hint: 'Chọn tủ và kỹ thuật viên' },
  { status: 'AWAITING_HANDOVER', label: 'Chờ bàn giao', hint: 'Kiểm tra báo cáo lắp đặt' },
];
export default function OperationsOverview({ session }: { session: Session }) {
  const enabled = session.role === 'OPERATIONS_MANAGER';
  const applications = useQuery({
    queryKey: ['operations-kiosk-applications', session.id, 'overview'],
    queryFn: () => request<KioskApplicationPage>('/operations/kiosk-applications?page=1&limit=5'),
    enabled,
  });
  const counts = useQueries({
    queries: stages.map(({ status }) => ({
      queryKey: ['operations-kiosk-applications', session.id, 'workbench', status],
      enabled,
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        readOperationsCount(
          (page) =>
            request<KioskApplicationPage>(
              `/operations/kiosk-applications?page=${page}&limit=50&status=${status}`,
            ),
          signal,
        ),
    })),
  });
  const reports = useQuery({
    queryKey: ['staff-tasks', 'OPERATIONS_MANAGER', session.id, 'overview-submitted'],
    enabled,
    queryFn: ({ signal }) =>
      readOperationsCount(
        (page) =>
          request<components['schemas']['StaffTaskPage']>(
            `/operations/staff-tasks?page=${page}&status=SUBMITTED`,
          ),
        signal,
      ),
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
  const queries = [applications, ...counts, reports, technicians, kiosks];
  const jobs = [
    ...stages.map((stage, index) => ({
      ...stage,
      href: `/operations/installations?status=${stage.status}`,
      query: counts[index],
    })),
    {
      status: 'SUBMITTED',
      label: 'Báo cáo chờ duyệt',
      hint: 'Kết quả xử lý sự cố',
      href: '/operations/tasks?status=SUBMITTED',
      query: reports,
    },
  ];
  if (!enabled)
    return (
      <p role="status">
        Chế độ giám sát:{' '}
        <Link href="/operations/installations">Xem hồ sơ thuê và lắp đặt kiosk</Link>.
      </p>
    );
  const queueQueries = [...counts, reports];
  const queueClear = queueQueries.every(
    (query) => query.isSuccess && query.data.count === 0 && !query.data.hasMore,
  );
  const dateLabel = (value: string | null | undefined) => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? null
      : date.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
  };
  return (
    <div className="operations-overview manager-overview">
      {queries.some((query) => query.isError) && (
        <p role="alert" className="operations-inline-error">
          Một số dữ liệu chưa tải được. Bấm Làm mới hoặc mở mục tương ứng để thử lại.
        </p>
      )}
      <div className="manager-overview-layout">
        <section className="manager-recent" aria-labelledby="operations-recent-title">
          <div className="manager-section-heading">
            <h2 id="operations-recent-title">Hồ sơ mới nhất</h2>
            <Link href="/operations/installations">
              Tất cả hồ sơ <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
          {applications.isPending && <p role="status">Đang tải hồ sơ…</p>}
          {applications.isError && <p role="alert">Chưa tải được hồ sơ. Hãy thử làm mới.</p>}
          {applications.isSuccess && applications.data.items.length === 0 && (
            <div className="operations-empty">
              <Store size={26} aria-hidden="true" />
              <h3>Chưa có hồ sơ thuê kiosk</h3>
              <p>Hồ sơ mới sẽ xuất hiện tại đây.</p>
            </div>
          )}
          {applications.isSuccess && (
            <ul className="manager-recent-list">
              {applications.data.items.map((item) => {
                const scheduled = ['SCHEDULED', 'INSTALLING'].includes(item.status)
                  ? dateLabel(item.scheduledDate)
                  : null;
                return (
                  <li key={item.id}>
                    <Link
                      href={`/operations/installations?application=${encodeURIComponent(item.id)}`}
                    >
                      <span className="manager-record-identity">
                        <span className="manager-record-icon" aria-hidden="true">
                          <Store size={20} />
                        </span>
                        <span>
                          <strong>{item.shopName}</strong>
                          <small>
                            {item.packageName} · Tiếp nhận{' '}
                            {dateLabel(item.createdAt) ?? 'chưa rõ ngày'}
                          </small>
                        </span>
                      </span>
                      <span className="kiosk-status-pill" data-status={item.status}>
                        {KIOSK_STATUS_LABELS[item.status] ?? item.status}
                      </span>
                      {scheduled && (
                        <span className="manager-record-schedule">
                          <Clock size={16} aria-hidden="true" />
                          <span>
                            <strong>
                              Lịch lắp đặt: {scheduled}
                              {item.timeWindow ? ` · ${item.timeWindow}` : ''}
                            </strong>
                            {item.assignedTechnicianName && (
                              <small>
                                {item.assignedTechnicianName}
                                {item.assignedKioskCode ? ` · ${item.assignedKioskCode}` : ''}
                              </small>
                            )}
                          </span>
                        </span>
                      )}
                      <span className="manager-row-action">
                        {managerApplicationAction(item.status)}{' '}
                        <ArrowRight size={16} aria-hidden="true" />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="manager-count-note">Hiển thị tối đa 5 hồ sơ gần nhất.</p>
        </section>
        <aside className="manager-overview-side" aria-label="Hàng đợi và nguồn lực">
          <section className="manager-workbench" aria-labelledby="manager-work-title">
            <div className="manager-section-heading">
              <h2 id="manager-work-title">Việc cần xử lý</h2>
              <Button
                variant="outline"
                aria-label="Làm mới"
                disabled={queries.some((query) => query.isFetching)}
                onClick={() => queries.forEach((query) => void query.refetch())}
              >
                <RefreshCw size={16} aria-hidden="true" />
                <span className="sr-only">Làm mới</span>
              </Button>
            </div>
            {queueClear && (
              <p className="manager-queue-clear" role="status">
                <CheckCircle2 size={17} aria-hidden="true" />
                Không có việc đang chờ
              </p>
            )}
            <nav className="manager-work-links" aria-label="Chọn việc cần xử lý">
              {jobs.map(({ status, label, href, query }) => (
                <Link
                  key={status}
                  href={href}
                  data-has-work={query.isSuccess && query.data.count > 0}
                >
                  <span>{label}</span>
                  <strong>
                    {query.isError
                      ? '—'
                      : query.isPending
                        ? '…'
                        : `${query.data.hasMore ? '≥ ' : ''}${query.data.count}`}
                  </strong>
                  <ArrowRight size={15} aria-hidden="true" />
                </Link>
              ))}
            </nav>
            {queueQueries.some(
              (query) => query.isPending || query.isError || query.data?.hasMore,
            ) && (
              <p className="manager-count-note" role="status">
                {queueQueries.some((query) => query.isPending)
                  ? 'Đang kiểm tra công việc…'
                  : queueQueries.some((query) => query.isError)
                    ? 'Có nhóm chưa tải được. Mở nhóm hoặc làm mới để thử lại.'
                    : 'Dấu ≥: còn dữ liệu sau 50 trang đã tải.'}
              </p>
            )}
          </section>
          <section className="manager-resources" aria-labelledby="manager-resources-title">
            <h2 id="manager-resources-title">Nguồn lực</h2>
            <Link href="/operations/technicians">
              <Users size={17} aria-hidden="true" />
              <span>Kỹ thuật viên hoạt động</span>
              <strong>
                {technicians.isError
                  ? '—'
                  : technicians.isPending
                    ? '…'
                    : technicians.data.filter((item) => item.status === 'ACTIVE').length}
              </strong>
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
            {technicians.isError && <p role="status">Chưa tải được kỹ thuật viên.</p>}
            <Link href="/operations/installations?inventory=1">
              <Boxes size={17} aria-hidden="true" />
              <span>Tủ có thể phân bổ</span>
              <strong>{kiosks.isError ? '—' : kiosks.isPending ? '…' : kiosks.data.length}</strong>
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
            {kiosks.isError && <p role="status">Chưa tải được kho tủ.</p>}
          </section>
        </aside>
      </div>
      <details className="manager-help" id="operations-guide">
        <summary>Hướng dẫn tiếp nhận và bàn giao kiosk</summary>
        <ol>
          <li>Xác nhận liên hệ và điều kiện lắp đặt với chủ shop.</li>
          <li>Chọn kỹ thuật viên, tủ phù hợp gói thuê và lịch lắp đặt.</li>
          <li>Kiểm tra báo cáo, ảnh nghiệm thu rồi xác nhận bàn giao.</li>
        </ol>
        <p>
          Việc xử lý sự cố được theo dõi riêng tại{' '}
          <Link href="/operations/tasks">Công việc kỹ thuật</Link>.
        </p>
      </details>
    </div>
  );
}
