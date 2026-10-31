import Link from 'next/link';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { ArrowRight, Button, Check, CircleAlert, Eye, Users } from '@florabot/ui';
import type { components } from '../../../../../packages/contracts/src/generated/api';
import { request, type Session } from '@/shared/lib/api';
import type { WebOrder } from '../orders/orders.types';
import { statusName } from '../orders/orders.utils';
import AdminQueueItem from './components/AdminQueueItem';
import { overviewQueueKeys, useAdminQueues } from './use-admin-queues';

type Row = { id: string; title: string; detail: string; state: string; createdAt?: string };
type Feed = { rows: Row[]; more: boolean };
type Incident = components['schemas']['AdminIncidentResponse'];
type Task = { id: string; kioskName: string; assigneeName: string; kind: string };
type Manager = { id: string; status: string };
const localDate = (value?: string) => {
  if (!value || !Number.isFinite(Date.parse(value))) return '';
  return new Date(value).toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

async function readFeed<T>(url: string, toRow: (value: T) => Row): Promise<Feed> {
  const result = await request<{ items: T[]; hasMore: boolean }>(url);
  if (!Array.isArray(result.items)) throw new Error('Không đọc được danh sách.');
  return { rows: result.items.map(toRow), more: result.hasMore === true };
}

function FeedPanel({
  title,
  query,
  href,
  action,
  empty,
  monitor = false,
}: {
  title: string;
  query: UseQueryResult<Feed>;
  href: string;
  action: string;
  empty: string;
  monitor?: boolean;
}) {
  return (
    <section className="admin-surface admin-feed-panel" aria-label={title}>
      <div className="admin-section-heading">
        <div>
          <h2>{title}</h2>
          {monitor && (
            <p className="admin-readonly-label">
              <Eye size={15} aria-hidden="true" /> Chỉ giám sát
            </p>
          )}
        </div>
        <Link className="admin-text-link" href={href}>
          {action}
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
      {query.isPending ? (
        <p role="status" className="admin-calm-empty">
          Đang tải danh sách…
        </p>
      ) : query.isError ? (
        <div className="admin-calm-empty">
          <CircleAlert size={24} aria-hidden="true" />
          <p role="alert">
            Chưa tải được {title.toLocaleLowerCase('vi')}. Kiểm tra kết nối hoặc thử lại.
          </p>
          <Button
            variant="outline"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            Thử lại {title.toLocaleLowerCase('vi')}
          </Button>
        </div>
      ) : query.data.rows.length === 0 ? (
        <div className="admin-calm-empty">
          <Check size={24} aria-hidden="true" />
          <h3>Chưa có mục nào trong danh sách</h3>
          <p>{empty}</p>
        </div>
      ) : (
        <ul className="admin-feed">
          {query.data.rows.slice(0, 3).map((row) => (
            <li key={row.id}>
              <div className="admin-feed-main">
                <strong>{row.title}</strong>
                <span className="dashboard-status" data-state={row.state}>
                  {row.state}
                </span>
              </div>
              <p>{row.detail}</p>
              {row.createdAt && localDate(row.createdAt) && (
                <time dateTime={row.createdAt}>{localDate(row.createdAt)}</time>
              )}
            </li>
          ))}
        </ul>
      )}
      {query.isSuccess && (
        <p className="admin-feed-note">
          {query.data.rows.length > 0
            ? `Hiển thị ${Math.min(query.data.rows.length, 3)} / ${query.data.rows.length} mục đã tải.`
            : 'Danh sách vừa tải chưa có mục nào.'}
          {query.data.more && ' Còn trang tiếp theo.'} Cập nhật{' '}
          {new Date(query.dataUpdatedAt).toLocaleTimeString('vi-VN', {
            timeZone: 'Asia/Ho_Chi_Minh',
            hour: '2-digit',
            minute: '2-digit',
          })}
          .
        </p>
      )}
    </section>
  );
}

function PersonnelSummary({ actorId }: { actorId: string }) {
  const query = useQuery({
    queryKey: ['dashboard-admin-managers', actorId],
    queryFn: async () => {
      const value = await request<Manager[] | { items: Manager[] }>('/admin/managers');
      const items = Array.isArray(value) ? value : value?.items;
      if (!Array.isArray(items)) throw new Error('Không đọc được danh sách quản lý.');
      return items;
    },
    refetchInterval: 60_000,
  });
  return (
    <section className="admin-surface admin-team-summary" aria-labelledby="admin-team-title">
      <div className="admin-section-heading">
        <div>
          <h2 id="admin-team-title">Đội ngũ Quản lý vận hành</h2>
          <p>Phụ trách điều phối kỹ thuật viên và triển khai các điểm kiosk.</p>
        </div>
        <Link href="/admin/managers" className="admin-text-link">
          <Users size={17} aria-hidden="true" />
          Quản lý tài khoản
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
      {query.isPending ? (
        <p role="status">Đang tải đội ngũ quản lý…</p>
      ) : query.isError ? (
        <div className="admin-inline-error">
          <p role="alert">Chưa tải được đội ngũ quản lý.</p>
          <Button
            variant="outline"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            Thử lại danh sách quản lý
          </Button>
        </div>
      ) : (
        <dl className="admin-team-counts">
          <div>
            <dt>Tổng số tài khoản</dt>
            <dd>{query.data.length}</dd>
          </div>
          <div>
            <dt>Đang hoạt động</dt>
            <dd>{query.data.filter((item) => item.status === 'ACTIVE').length}</dd>
          </div>
          <div>
            <dt>Tạm khóa / Vô hiệu hóa</dt>
            <dd>
              {query.data.filter((item) => ['LOCKED', 'DISABLED'].includes(item.status)).length}
            </dd>
          </div>
        </dl>
      )}
    </section>
  );
}

export default function AdminOverview({ session }: { session: Session }) {
  const queues = useAdminQueues(session.id, overviewQueueKeys);
  const incidents = useQuery({
    queryKey: ['dashboard-incidents', session.id],
    queryFn: () =>
      readFeed<Incident>('/admin/incidents?status=OPEN&page=1', (row) => ({
        id: row.id,
        title: row.location?.kioskName || 'Sự cố tại tủ',
        detail: row.reason,
        state: 'Đang mở',
        createdAt: row.createdAt,
      })),
    refetchInterval: 60_000,
  });
  const reports = useQuery({
    queryKey: ['dashboard-reports', session.id],
    queryFn: () =>
      readFeed<Task>('/admin/staff-tasks?page=1&status=SUBMITTED', (row) => ({
        id: row.id,
        title: `${row.kind === 'INCIDENT' ? 'Kiểm tra sự cố' : 'Giao hoa'} · ${row.kioskName}`,
        detail: row.assigneeName,
        state: 'Đã gửi báo cáo',
      })),
    refetchInterval: 60_000,
  });
  const orders = useQuery({
    queryKey: ['dashboard-orders', session.id, '/admin'],
    queryFn: () =>
      readFeed<WebOrder>('/admin/preorders?page=1', (row) => ({
        id: row.id,
        title: row.productName || row.orderCode || 'Yêu cầu đặt hoa',
        detail: `${row.kioskName || 'Tủ nhận'}${localDate(row.pickupAt) ? ` · Hẹn nhận ${localDate(row.pickupAt)}` : ''}`,
        state: statusName(row),
      })),
    refetchInterval: 60_000,
  });
  return (
    <div className="admin-overview">
      <div className="admin-overview-priority">
        <section className="admin-surface admin-work-queue" aria-labelledby="admin-work-title">
          <div className="admin-section-heading">
            <div>
              <h2 id="admin-work-title">Cần bạn xử lý</h2>
              <p>Phản ánh và các yêu cầu tài chính đang chờ kiểm tra.</p>
            </div>
          </div>
          <div className="admin-queue-list">
            {queues.map(({ queue, query }) => (
              <AdminQueueItem key={queue.key} queue={queue} query={query} compact />
            ))}
          </div>
          <p className="admin-feed-note">
            Số lượng theo lần tải hiện tại; dấu + nghĩa là còn trang tiếp theo.
          </p>
        </section>
        <FeedPanel
          title="Sự cố cần xử lý"
          query={incidents}
          href="/admin/incidents"
          action="Xem sự cố"
          empty="Chưa có sự cố đang mở trong danh sách vừa tải."
        />
      </div>
      <div className="admin-overview-secondary">
        <FeedPanel
          title="Yêu cầu đặt hoa gần đây"
          query={orders}
          href="/admin/orders"
          action="Xem đơn"
          empty="Yêu cầu mới sẽ xuất hiện khi khách đặt hoa trên website."
          monitor
        />
        <FeedPanel
          title="Báo cáo cần theo dõi"
          query={reports}
          href="/admin/tasks"
          action="Giám sát báo cáo"
          empty="Chưa có báo cáo đã gửi trong danh sách. Quản lý vận hành hoặc chủ shop phụ trách kiểm tra kết quả."
          monitor
        />
      </div>
      <PersonnelSummary actorId={session.id} />
    </div>
  );
}
