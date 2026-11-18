import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@florabot/ui';
import type { components } from '../../../../../../packages/contracts/src/generated/api';
import { request } from '@/shared/lib/api';
import { Modal } from '@/shared/components/Modal';
import { revenueInteger } from '../revenue-report.utils';

type Page = components['schemas']['AdminSellerOrderPage'];
type Detail = components['schemas']['AdminSellerOrderDetail'];
const money = (value: number | string) => {
  const n = revenueInteger(value);
  return n === null ? 'Không đọc được số tiền' : `${n.toLocaleString('vi-VN')} đ`;
};
const labels: Record<string, string> = {
  CREATED: 'Mới tạo',
  AWAITING_PAYMENT: 'Chờ thanh toán',
  PAID: 'Đã thanh toán',
  DISPENSING: 'Đang giao hoa',
  DISPENSE_FAILED: 'Giao hoa thất bại',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Đã hủy',
  EXPIRED: 'Hết hạn',
  REFUNDED: 'Đã hoàn tiền',
  SUCCEEDED: 'Thành công',
  FAILED: 'Thất bại',
  PENDING: 'Đang chờ',
  CHARGE: 'Thu tiền',
  REFUND: 'Hoàn tiền',
};
const date = (value: string) =>
  new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

function OrderDetail({
  actorId,
  sellerId,
  id,
  onClose,
}: {
  actorId: string;
  sellerId: string;
  id: string;
  onClose: () => void;
}) {
  const detail = useQuery({
    queryKey: ['admin-seller-order-detail', actorId, sellerId, id],
    queryFn: () => request<Detail>(`/admin/sellers/${sellerId}/orders/${id}`),
  });
  return (
    <Modal
      open
      size="lg"
      className="admin-order-report-modal"
      title={detail.data ? `Đơn ${detail.data.orderCode}` : 'Chi tiết đơn mua / hủy'}
      onClose={onClose}
    >
      {detail.isPending ? (
        <p role="status">Đang đọc chi tiết đơn…</p>
      ) : detail.isError ? (
        <div role="alert">
          <p>Chưa đọc được đơn: {detail.error.message}</p>
          <Button variant="outline" onClick={() => void detail.refetch()}>
            Thử lại chi tiết đơn
          </Button>
        </div>
      ) : (
        <>
          <p>
            {detail.data.kioskCode} · {detail.data.kioskName}
          </p>
          <p>
            {labels[detail.data.status] || detail.data.status} · Giá trị đơn{' '}
            {money(detail.data.totalAmount)}
          </p>
          <p>Ngày tạo: {date(detail.data.createdAt)}</p>
          <div className="reports-table-wrap">
            <table>
              <caption>Hàng trong đơn</caption>
              <thead>
                <tr>
                  <th>Sản phẩm</th>
                  <th>Số lượng</th>
                  <th>Đơn giá</th>
                  <th>Thành tiền</th>
                </tr>
              </thead>
              <tbody>
                {detail.data.items.map((item, index) => (
                  <tr key={index}>
                    <td>{item.name}</td>
                    <td>{item.quantity}</td>
                    <td>{money(item.unitPrice)}</td>
                    <td>{money(item.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h3>Khoản thu / hoàn phân bổ cho đơn</h3>
          <p className="quiet">
            Tiền thanh toán có thể được phân bổ cho nhiều đơn. Không cộng toàn bộ lượt thanh toán
            vào từng đơn.
          </p>
          {!detail.data.payments.length ? (
            <p>Chưa có giao dịch liên kết.</p>
          ) : (
            <ul>
              {detail.data.payments.map((item) => (
                <li key={`${item.id}:${item.kind}`}>
                  {labels[item.kind] || item.kind} · {money(item.amount)} ·{' '}
                  {labels[item.status] || item.status} · {date(item.paidAt || item.createdAt)}
                </li>
              ))}
            </ul>
          )}
          <p className="quiet">Hồ sơ đối chiếu đơn hàng, không thay thế hóa đơn thuế.</p>
        </>
      )}
    </Modal>
  );
}

export default function AdminSellerOrders({
  actorId,
  sellerId,
  from,
  to,
  kioskId,
}: {
  actorId: string;
  sellerId: string;
  from: string;
  to: string;
  kioskId: string;
}) {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const params = new URLSearchParams({
    from: from.slice(0, 10),
    to: to.slice(0, 10),
    page: String(page),
    ...(kioskId ? { kioskId } : {}),
    ...(status ? { status } : {}),
  });
  const orders = useQuery({
    queryKey: ['admin-seller-orders', actorId, sellerId, from, to, kioskId, status, page],
    queryFn: () => request<Page>(`/admin/sellers/${sellerId}/orders?${params}`),
  });
  return (
    <section aria-label="Đơn mua và hủy của shop">
      <label htmlFor="admin-seller-order-status">Trạng thái đơn hàng</label>
      <select
        id="admin-seller-order-status"
        value={status}
        onChange={(e) => {
          setStatus(e.target.value);
          setPage(1);
        }}
      >
        <option value="">Tất cả đơn</option>
        {[
          'AWAITING_PAYMENT',
          'PAID',
          'DISPENSING',
          'COMPLETED',
          'CANCELLED',
          'EXPIRED',
          'REFUNDED',
        ].map((value) => (
          <option key={value} value={value}>
            {labels[value]}
          </option>
        ))}
      </select>
      <p className="quiet">Danh sách lọc theo ngày tạo đơn, tách biệt kỳ ghi nhận thu tiền.</p>
      {orders.isPending ? (
        <p role="status">Đang tải đơn của shop…</p>
      ) : orders.isError ? (
        <div role="alert">
          <p>Chưa tải được đơn: {orders.error.message}</p>
          <Button variant="outline" onClick={() => void orders.refetch()}>
            Thử lại danh sách đơn
          </Button>
        </div>
      ) : (
        <>
          {!orders.data.items.length ? (
            <p>Không có đơn khớp bộ lọc.</p>
          ) : (
            <div className="reports-table-wrap">
              <table>
                <caption>Đơn mua / hủy · Trang {page}</caption>
                <thead>
                  <tr>
                    <th>Đơn / ngày tạo</th>
                    <th>Kiosk</th>
                    <th>Loại đơn</th>
                    <th>Giá trị</th>
                    <th>Trạng thái</th>
                    <th>Chi tiết</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.data.items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        {item.orderCode}
                        <br />
                        {date(item.createdAt)}
                      </td>
                      <td>
                        {item.kioskCode} · {item.kioskName}
                      </td>
                      <td>{item.mode === 'PREORDER' ? 'Đặt trước' : 'Mua tại tủ'}</td>
                      <td>{money(item.totalAmount)}</td>
                      <td>{labels[item.status] || item.status}</td>
                      <td>
                        <Button
                          variant="outline"
                          aria-label={`Xem đơn ${item.orderCode}`}
                          onClick={() => setSelected(item.id)}
                        >
                          Xem đơn
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <nav className="stock-actions" aria-label="Phân trang đơn seller">
            <Button
              variant="outline"
              disabled={page === 1 || orders.isFetching}
              onClick={() => setPage((value) => value - 1)}
            >
              Đơn trang trước
            </Button>
            <span>Trang {page}</span>
            <Button
              variant="outline"
              disabled={!orders.data.hasMore || orders.isFetching}
              onClick={() => setPage((value) => value + 1)}
            >
              Đơn trang sau
            </Button>
          </nav>
        </>
      )}
      {selected && (
        <OrderDetail
          key={selected}
          actorId={actorId}
          sellerId={sellerId}
          id={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </section>
  );
}
