const movementLabels: Record<string, string> = {
  STOCK_IN: 'Nạp hoa',
  HOLD: 'Giữ hoa cho đơn hàng',
  RELEASE: 'Hủy giữ hoa',
  SALE_OUT: 'Đã bán',
  EXPIRE_OUT: 'Hoa hết hạn bán',
  DAMAGE: 'Ghi nhận hoa hỏng',
  RETURN_SELLER: 'Trả hoa về shop',
};

export function inventoryMovementLabel(type: string): string {
  return movementLabels[type] ?? 'Thay đổi tồn kho';
}

export function inventoryActorLabel(actorId: string | null, name: string | null): string {
  if (actorId === '10000000-0000-0000-0000-0000000000ff') return 'Tự động';
  return name?.trim() || 'Không ghi nhận người thực hiện';
}
