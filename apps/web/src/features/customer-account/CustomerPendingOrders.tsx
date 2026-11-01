import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Button } from '@florabot/ui';
import { request, sessionQuery } from '@/shared/lib/api';
import type { OrderPage, WebOrder } from '../orders/orders.types';
import { needsOrderAction, orderClosed, statusName, when } from '../orders/orders.utils';

function actionLabel(row: WebOrder) {
  if (row.ready && row.orderStatus === 'PAID') return 'Xem hướng dẫn nhận';
  if (row.orderStatus === 'AWAITING_PAYMENT') return 'Xem thanh toán';
  if (row.state === 'QUOTED') return 'Xem báo giá';
  return 'Xem yêu cầu';
}

export default function CustomerPendingOrders() {
  const session = useQuery(sessionQuery);
  const orders = useQuery({
    queryKey: ['web-orders', '/member/preorders', 1, session.data?.id],
    enabled: session.data?.role === 'CUSTOMER',
    queryFn: () => request<OrderPage>('/member/preorders?page=1'),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
  const items = (orders.data?.items ?? [])
    .filter((row) => !orderClosed(row))
    .sort((a, b) => {
      const priority = (row: WebOrder) =>
        needsOrderAction(row, 'member') || (row.ready && row.orderStatus === 'PAID') ? 0 : 1;
      return priority(a) - priority(b);
    })
    .slice(0, 3);
  return (
    <section
      className="account-pending"
      aria-labelledby="account-pending-title"
      aria-busy={orders.isFetching}
    >
      <div className="account-pending-heading">
        <h2 id="account-pending-title">Đơn đang theo dõi</h2>
        <Link href="/tai-khoan#web-orders">
          Tất cả đơn <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </div>
      {orders.isPending ? (
        <p role="status">Đang tải đơn đặt trước…</p>
      ) : orders.isError ? (
        <div role="alert" className="account-pending-error">
          <p>Chưa tải được đơn đặt trước. Bạn vẫn có thể xem các mục khác.</p>
          <Button variant="outline" onClick={() => void orders.refetch()}>
            Tải lại đơn
          </Button>
        </div>
      ) : items.length ? (
        <>
          <ul className="account-pending-list">
            {items.map((row) => (
              <li key={row.id}>
                <div>
                  <strong>{row.productName || row.shopName || 'Yêu cầu đặt hoa'}</strong>
                  <span>{statusName(row)}</span>
                  {row.pickupAt && <small>Nhận dự kiến: {when(row.pickupAt)}</small>}
                </div>
                <Link href={`/tai-khoan?requestId=${encodeURIComponent(row.id)}#web-orders`}>
                  {actionLabel(row)} <ArrowRight size={15} aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
          {orders.data?.hasMore && (
            <p className="account-pending-scope">
              Một số đơn gần đây. Chọn Tất cả đơn để xem danh sách đầy đủ.
            </p>
          )}
        </>
      ) : (
        <p className="account-pending-empty">
          {orders.data?.hasMore
            ? 'Chưa thấy đơn đang xử lý trong danh sách vừa tải. Chọn Tất cả đơn để kiểm tra thêm.'
            : 'Chưa có đơn đặt trước đang xử lý. Khi gửi yêu cầu báo giá, bạn có thể theo dõi tại đây.'}
        </p>
      )}
    </section>
  );
}
