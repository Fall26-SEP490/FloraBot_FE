import Link from 'next/link';
import { useQueries } from '@tanstack/react-query';
import { Button, RefreshCw } from '@florabot/ui';
import { request } from '@/shared/lib/api';
import '../styles/admin-approvals.css';

const queues = [
  {
    key: 'installations',
    title: 'Hồ sơ thuê kiosk mới',
    owner: 'Manager',
    endpoint: '/operations/kiosk-applications?status=PAID_REVIEW&page=1&limit=10',
    description:
      'Customer đã thanh toán; Manager xác nhận liên hệ, phân công Technician và bàn giao.',
    link: 'Xem giám sát hồ sơ thuê',
  },
  {
    key: 'shops',
    title: 'Shop chờ duyệt theo luồng cũ',
    owner: 'Admin',
    endpoint: '/admin/sellers?status=PENDING',
    description:
      'Các shop đã có trong hệ thống và đang chờ phê duyệt gói. Không phải hồ sơ thuê kiosk mới.',
    link: 'Xem hồ sơ shop',
  },
  {
    key: 'complaints',
    title: 'Phản ánh của khách',
    owner: 'Admin',
    endpoint: '/admin/complaints?status=OPEN&page=1',
    description: 'Đọc đơn, bằng chứng và quyết định xử lý phản ánh hoặc đề xuất hoàn tiền.',
    link: 'Xử lý phản ánh',
  },
  {
    key: 'refunds',
    title: 'Hoàn tiền đơn hoa',
    owner: 'Admin',
    endpoint: '/admin/refunds?status=PENDING&page=1',
    description: 'Kiểm tra điều kiện duyệt, chứng từ và người chi trả khác người duyệt.',
    link: 'Xử lý hoàn tiền đơn hoa',
  },
  {
    key: 'kiosk-refunds',
    title: 'Hoàn tiền thuê kiosk',
    owner: 'Admin',
    endpoint: '/admin/kiosk-applications/refunds',
    description: 'Duyệt hồ sơ hoàn phí thuê; hai Admin thực hiện riêng bước duyệt và xác nhận chi.',
    link: 'Xử lý hoàn tiền thuê kiosk',
  },
  {
    key: 'withdrawals',
    title: 'Yêu cầu rút tiền của shop',
    owner: 'Admin',
    endpoint: '/admin/withdrawals?status=PENDING&page=1',
    description: 'Kiểm tra số dư, duyệt hoặc từ chối; ghi nhận chứng từ sau khi chuyển tiền.',
    link: 'Xử lý rút tiền',
  },
  {
    key: 'incidents',
    title: 'Sự cố kiosk đang mở',
    owner: 'Admin',
    endpoint: '/admin/incidents?status=OPEN&page=1',
    description:
      'Xem sự cố và kết quả xử lý. Công việc lắp đặt mới được theo dõi trong Hồ sơ thuê kiosk.',
    link: 'Xem sự cố kiosk',
  },
];

function readQueue(value: unknown): number {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === 'object' && 'items' in value && Array.isArray(value.items))
    return value.items.length;
  throw new Error('Dữ liệu hàng đợi chưa đúng định dạng. Hãy thử tải lại.');
}

export default function AdminApprovalCenter({ actorId }: { actorId: string }) {
  const queries = useQueries({
    queries: queues.map((queue) => ({
      queryKey: ['admin-approval-queue', actorId, queue.key],
      queryFn: async () => readQueue(await request<unknown>(queue.endpoint)),
      staleTime: 0,
    })),
  });
  return (
    <section className="admin-approval-center" aria-labelledby="approval-center-title">
      <div className="admin-approval-heading">
        <div>
          <h2 id="approval-center-title">Các mục cần kiểm tra và duyệt</h2>
          <p>Mở đúng hàng đợi để xem chi tiết, điều kiện và bước xử lý tiếp theo.</p>
        </div>
        <Button
          variant="outline"
          disabled={queries.some((query) => query.isFetching)}
          onClick={() => void Promise.all(queries.map((query) => query.refetch()))}
        >
          <RefreshCw size={16} aria-hidden="true" /> Làm mới các hàng đợi
        </Button>
      </div>
      <p className="quiet">
        Số lượng bên dưới là các yêu cầu được trả về trong lần tải hiện tại. Mở danh sách để lọc và
        xem các trang tiếp theo.
      </p>
      <div className="admin-approval-grid">
        {queues.map((queue, index) => {
          const query = queries[index];
          return (
            <article
              key={queue.key}
              className="admin-approval-card"
              aria-labelledby={`approval-${queue.key}`}
            >
              <div className="admin-approval-card-heading">
                <h3 id={`approval-${queue.key}`}>{queue.title}</h3>
                <span className="status-pill">{queue.owner}</span>
              </div>
              <p>{queue.description}</p>
              {query.isPending ? (
                <p role="status">Đang tải hàng đợi…</p>
              ) : query.isError ? (
                <div role="alert">
                  <p>Chưa tải được hàng đợi này.</p>
                  <Button variant="outline" onClick={() => void query.refetch()}>
                    Thử lại {queue.title.toLocaleLowerCase('vi')}
                  </Button>
                </div>
              ) : (
                <p className="admin-approval-count">
                  <strong>{query.data}</strong> yêu cầu đang hiển thị
                </p>
              )}
              <Link className="button button-outline" href={`/admin/${queue.key}`}>
                {queue.link}
              </Link>
            </article>
          );
        })}
      </div>
    </section>
  );
}
