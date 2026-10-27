import { ORDER_STATES, REQUEST_STATES } from './orders.constants';
import type { OrderFilter, OrderMode, OrderPhase, WebOrder } from './orders.types';

export const money = (value: number) => value.toLocaleString('vi-VN') + ' đ';

export const when = (value: string) =>
  new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

export const statusName = (row: WebOrder) =>
  row.orderStatus === 'PAID' && row.ready
    ? 'Hoa đã sẵn sàng tại tủ'
    : row.orderStatus
      ? ORDER_STATES[row.orderStatus] || row.orderStatus
      : REQUEST_STATES[row.state] || row.state;

export function orderStage(row: OrderPhase): number {
  if (row.orderStatus === 'COMPLETED') return 4;
  if (row.ready || row.orderStatus === 'DISPENSING') return 3;
  if (row.orderStatus === 'PAID') return 2;
  if (row.orderStatus === 'AWAITING_PAYMENT' || row.state === 'QUOTED') return 1;
  return 0;
}

export function orderClosed(row: OrderPhase) {
  return (
    ['COMPLETED', 'CANCELLED', 'EXPIRED', 'REFUNDED'].includes(row.orderStatus ?? row.state) ||
    row.state === 'REJECTED'
  );
}

export function needsOrderAction(row: OrderPhase, mode: OrderMode) {
  if (orderClosed(row)) return false;
  if (mode === 'member') return row.state === 'QUOTED' || row.orderStatus === 'AWAITING_PAYMENT';
  if (mode === 'seller')
    return (
      ['REQUESTED', 'QUOTED'].includes(row.state) || (row.orderStatus === 'PAID' && !row.ready)
    );
  return ['DISPUTED', 'DISPENSE_FAILED'].includes(row.orderStatus ?? '');
}

export function matchesOrderFilter(row: OrderPhase, filter: OrderFilter, mode: OrderMode) {
  switch (filter) {
    case 'attention':
      return needsOrderAction(row, mode);
    case 'preparing':
      return row.orderStatus === 'PAID' && !row.ready;
    case 'ready':
      return row.ready && row.orderStatus === 'PAID';
    case 'closed':
      return orderClosed(row);
    default:
      return true;
  }
}

export function orderNextStep(row: OrderPhase, mode: OrderMode) {
  if (row.orderStatus === 'COMPLETED')
    return 'Đã hoàn tất theo trạng thái backend. Biên nhận lưu thông tin giao dịch và hỗ trợ phản ánh.';
  if (orderClosed(row))
    return 'Yêu cầu đã kết thúc. Khoản hoàn, nếu có, được theo dõi qua biên nhận và quy trình admin.';
  if (row.orderStatus === 'DISPUTED' || row.orderStatus === 'DISPENSE_FAILED')
    return 'Giữ biên nhận để theo dõi phản ánh hoặc khoản hoàn. Không tự gửi lại lệnh thiết bị.';
  if (row.orderStatus === 'DISPENSING')
    return 'Theo dõi trạng thái nhận hoa từ backend. Chỉ cảm biến hoặc quy trình vận hành hợp lệ mới xác nhận đã nhận.';
  if (row.ready)
    return 'Hoa đã được shop ghi nhận tại tủ. Khách đến đúng địa điểm và thời gian trên đơn; trạng thái này chưa xác nhận cửa đã mở.';
  if (row.orderStatus === 'PAID')
    return mode === 'seller'
      ? 'Chuẩn bị đúng mẫu đã chốt, đặt vào ô hợp lệ tại tủ nhận rồi ghi nhận nạp hoa.'
      : 'Thanh toán đã được xác nhận. Chờ shop chuẩn bị và thông báo hoa sẵn sàng.';
  if (row.orderStatus === 'AWAITING_PAYMENT')
    return 'Khách thanh toán trong thời hạn. Trang quay về từ payOS không tự xác nhận đã nhận tiền.';
  if (row.state === 'QUOTED')
    return mode === 'member'
      ? 'Đối chiếu giá, ghi chú và lịch nhận. Đồng ý báo giá trước khi tạo liên kết thanh toán.'
      : 'Chờ khách xác nhận báo giá; chưa chuẩn bị hoặc giao hoa khi chưa xác nhận thanh toán.';
  return mode === 'seller'
    ? 'Kiểm tra yêu cầu, phản hồi giá và lịch nhận hoặc từ chối kèm lý do.'
    : 'Shop đang xem yêu cầu để gửi báo giá và lịch nhận phù hợp.';
}
