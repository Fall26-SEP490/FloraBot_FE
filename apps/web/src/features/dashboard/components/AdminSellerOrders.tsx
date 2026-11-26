import { liveListOptions } from '@/shared/lib/live-list';
/* eslint-disable jsx-a11y/no-noninteractive-tabindex -- Scrollable report regions need keyboard focus for horizontal scrolling. */
import Select from '@/shared/components/Select';
import { useState } from 'react';
import './report-sheet.css';
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
  DISPUTED: 'Đang xử lý khiếu nại',
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
          <div className="order-detail-summary">
            <div>
              <span className="sheet-status" data-state={detail.data.status}>
                {labels[detail.data.status] || detail.data.status}
              </span>
              <strong className="order-detail-total">{money(detail.data.totalAmount)}</strong>
            </div>
            <p>
              {detail.data.kioskCode} · {detail.data.kioskName}
            </p>
            <time dateTime={detail.data.createdAt}>{date(detail.data.createdAt)}</time>
          </div>
          <div className="admin-report-sheet" role="region" aria-label="Bảng đơn hàng" tabIndex={0}>
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
                {!detail.data.items.length && (
                  <tr>
                    <td colSpan={4} className="order-detail-empty">
                      Chưa có chi tiết sản phẩm từ hệ thống.
                    </td>
                  </tr>
                )}
                {detail.data.items.map((item, index) => (
                  <tr key={index}>
                    <td>{item.name}</td>
                    <td className="sheet-number">{item.quantity}</td>
                    <td className="sheet-number">{money(item.unitPrice)}</td>
                    <td className="sheet-number">{money(item.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!detail.data.payments.length ? (
            <p>Chưa có giao dịch liên kết.</p>
          ) : (
            <div
              className="admin-report-sheet"
              role="region"
              aria-label="Bảng khoản thu và hoàn"
              tabIndex={0}
            >
              <table>
                <caption>Khoản thu / hoàn của đơn</caption>
                <thead>
                  <tr>
                    <th scope="col">Loại</th>
                    <th scope="col">Số tiền</th>
                    <th scope="col">Trạng thái</th>
                    <th scope="col">Thời gian</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.data.payments.map((item) => (
                    <tr key={`${item.id}:${item.kind}`}>
                      <td>{labels[item.kind] || item.kind}</td>
                      <td className="sheet-number">{money(item.amount)}</td>
                      <td>
                        <span className="sheet-status" data-state={item.status}>
                          {labels[item.status] || item.status}
                        </span>
                      </td>
                      <td className="sheet-date">{date(item.paidAt || item.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
    ...liveListOptions(!selected),
    queryKey: ['admin-seller-orders', actorId, sellerId, from, to, kioskId, status, page],
    queryFn: () => request<Page>(`/admin/sellers/${sellerId}/orders?${params}`),
  });
  return (
    <section aria-label="Đơn mua và hủy của shop">
      <label htmlFor="admin-seller-order-status">Trạng thái đơn hàng</label>
      <Select
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
          'DISPENSE_FAILED',
          'COMPLETED',
          'DISPUTED',
          'CANCELLED',
          'EXPIRED',
          'REFUNDED',
        ].map((value) => (
          <option key={value} value={value}>
            {labels[value]}
          </option>
        ))}
      </Select>
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
            <div
              className="admin-report-sheet admin-order-list"
              role="region"
              aria-label="Bảng đơn hàng"
              tabIndex={0}
            >
              <table>
                <thead>
                  <tr>
                    <th scope="col">Mã đơn</th>
                    <th scope="col">Ngày tạo</th>
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
                        <strong className="sheet-code">{item.orderCode}</strong>
                      </td>
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
                        {item.kioskCode} · {item.kioskName}
                      </td>
                      <td>{item.mode === 'PREORDER' ? 'Đặt trước' : 'Mua tại tủ'}</td>
                      <td className="sheet-number">{money(item.totalAmount)}</td>
                      <td>
                        <span className="sheet-status" data-state={item.status}>
                          {labels[item.status] || item.status}
                        </span>
                      </td>
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
