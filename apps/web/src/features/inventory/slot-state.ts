import type { components } from '../../../../../packages/contracts/src/generated/api';

// Additive response fields supplied by the slots API; older deployments may omit them.
export type SellerSlot = components['schemas']['SellerSlotResponse'] & {
  zone?: string | null;
  bouquetStatus?: string | null;
  orderId?: string | null;
  orderCode?: string | null;
  orderStatus?: string | null;
  paymentStatus?: string | null;
  sensorEnabled?: boolean;
  sensorReady?: boolean;
  manualRetryEnabled?: boolean;
  doorState?: 'OPEN' | 'CLOSED' | 'UNKNOWN' | null;
  maintenanceStage?: string | null;
};

export type SlotMaintenanceProgress = { key: string; label: string; hint: string };

export function slotMaintenanceProgress(
  slot: Pick<SellerSlot, 'status' | 'doorState' | 'maintenanceStage'>,
  session?: { stage: string; substate: string | null; currentCmdId: string | null } | null,
): SlotMaintenanceProgress | null {
  if (slot.status !== 'LOCKED') return null;
  const stage = slot.maintenanceStage === undefined ? session?.stage : slot.maintenanceStage;
  if (stage === 'NeedsInspection') {
    return { key: 'FAULT', label: 'Cần kiểm tra ô', hint: 'Mở chi tiết để xem cách xử lý.' };
  }
  if (stage === 'Completed' || stage === 'Recovered') return null;
  if (slot.doorState === 'OPEN') {
    return {
      key: 'DOOR_OPEN',
      label: 'Cửa đang mở',
      hint: stage === 'AwaitLoading' ? 'Đặt hoa vào ô rồi đóng cửa.' : 'Đóng cửa sau khi thao tác.',
    };
  }
  if (stage !== 'AwaitLoading' && stage !== 'AwaitRemoval') return null;
  if (session?.substate === 'RemovalClosedEmptyConfirmed' && !session.currentCmdId) {
    return { key: 'DOOR_PENDING', label: 'Chờ mở lại', hint: 'Mở lại cửa để đặt hoa mới vào ô.' };
  }
  if (slot.doorState === 'CLOSED') {
    return {
      key: 'DOOR_PENDING',
      label: stage === 'AwaitLoading' ? 'Đang xác nhận nạp' : 'Đang xác nhận thu hồi',
      hint: 'Cửa đã đóng. Hệ thống đang kiểm tra cảm biến hoa.',
    };
  }
  // The older session API records that the door opened, but cannot say whether it is still open.
  if (session?.substate === 'LoadingDoorOpened' || session?.substate === 'RemovalDoorOpened') {
    return {
      key: 'DOOR_PENDING',
      label: 'Đã xác nhận mở cửa',
      hint: 'Đóng cửa sau khi thao tác và chờ hệ thống xác nhận.',
    };
  }
  return {
    key: 'DOOR_PENDING',
    label: 'Chờ mở cửa',
    hint: 'Chờ tủ xác nhận cửa đã mở rồi mới thao tác.',
  };
}

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
  PENDING_REMOVAL: 'Chờ thu hồi hoa',
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
