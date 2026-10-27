import type { StaffStockPayload } from './inventory.types';

export function slotZoneDescription(slotCode: string): string {
  const upper = slotCode.trim().toUpperCase();
  if (upper.startsWith('W')) return 'Bán trực tiếp tại Kiosk (Walk-in)';
  if (upper.startsWith('P')) return 'Đơn đặt trước trên Web (Pre-order)';
  return 'Dùng chung: Bán tại Kiosk & Đặt trước trên Web';
}

export const money = (value: number | string) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(value));

export function restoreStaffStockPayload(key: string): StaffStockPayload | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(key) || 'null') as StaffStockPayload | null;
    return value &&
      ['id', 'productId', 'slotId', 'qrCode'].every(
        (field) => typeof value[field as keyof StaffStockPayload] === 'string',
      )
      ? value
      : null;
  } catch {
    return null;
  }
}
