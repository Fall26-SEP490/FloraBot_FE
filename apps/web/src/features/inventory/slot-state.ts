import type { components } from '../../../../../packages/contracts/src/generated/api';

// Additive response fields supplied by the slots API; older deployments may omit them.
export type SellerSlot = components['schemas']['SellerSlotResponse'] & {
  zone?: string | null;
  bouquetStatus?: string | null;
  orderId?: string | null;
  orderCode?: string | null;
  orderStatus?: string | null;
  paymentStatus?: string | null;
};

type SlotState = Pick<
  SellerSlot,
  | 'status'
  | 'bouquetId'
  | 'bouquetStatus'
  | 'orderId'
  | 'orderCode'
  | 'orderStatus'
  | 'paymentStatus'
>;

const slotLabels: Record<string, string> = {
  FREE: 'Chưa cho thuê',
  RENTED_EMPTY: 'Ô trống',
  STOCKED: 'Đã nạp hoa',
  HELD: 'Ô đang được giữ',
  PENDING_REMOVAL: 'Chờ lấy hoa hết hạn',
  PENDING_RELEASE: 'Chờ lấy hoa về để trả ô',
  FAULT: 'Có sự cố',
  LOCKED: 'Đang khóa',
};

const warnings = new Set(['FAULT', 'LOCKED', 'PENDING_REMOVAL', 'PENDING_RELEASE']);

export function slotWarning(slot: Pick<SellerSlot, 'status'>) {
  return warnings.has(slot.status) ? slotLabels[slot.status] : null;
}

export function slotSaleState(slot: SlotState): { key: string; label: string } {
  if (slot.orderStatus === 'DISPENSE_FAILED') {
    return { key: 'DISPENSE_FAILED', label: 'Nhận hoa thất bại — cần xử lý' };
  }
  if (slot.bouquetStatus === 'SOLD' && slot.paymentStatus === 'SUCCEEDED') {
    if (slot.orderStatus === 'PAID')
      return { key: 'SOLD_WAITING', label: 'Đã bán — chờ khách nhận' };
    if (slot.orderStatus === 'DISPENSING')
      return { key: 'SOLD_DISPENSING', label: 'Đã bán — đang xử lý nhận hoa' };
  }
  if (
    slot.bouquetStatus === 'HELD' &&
    slot.orderStatus === 'AWAITING_PAYMENT' &&
    slot.paymentStatus === 'PENDING'
  ) {
    return { key: 'PAYING', label: 'Khách đang thanh toán' };
  }
  if (
    slot.status === 'STOCKED' &&
    slot.bouquetStatus === 'STOCKED' &&
    !slot.orderId &&
    !slot.orderCode &&
    !slot.orderStatus
  ) {
    return { key: 'ON_SALE', label: 'Đang bán' };
  }
  if (slot.status === 'RENTED_EMPTY' && !slot.bouquetId) {
    return { key: 'RENTED_EMPTY', label: 'Ô trống' };
  }
  if (slot.status === 'RENTED_EMPTY') {
    return { key: 'UNKNOWN', label: 'Cần kiểm tra dữ liệu ô' };
  }
  // Unknown combinations must not imply that a bouquet is for sale or awaiting payment.
  return { key: slot.status, label: slotLabels[slot.status] || slot.status };
}

export function slotNeedsAttention(slot: SlotState) {
  return (
    warnings.has(slot.status) || slot.status === 'HELD' || slot.orderStatus === 'DISPENSE_FAILED'
  );
}
