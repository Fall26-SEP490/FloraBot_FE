export type SavedReceipt = { orderId: string; token: string; orderCode: string; savedAt: string };
const key = 'florabot-personal-receipts-v1';
const valid = (value: unknown): value is SavedReceipt => {
  if (!value || typeof value !== 'object') return false;
  const item = value as SavedReceipt;
  return (
    typeof item.orderId === 'string' &&
    /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(item.orderId) &&
    typeof item.token === 'string' &&
    /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/.test(item.token) &&
    typeof item.orderCode === 'string' &&
    item.orderCode.length > 0 &&
    item.orderCode.length <= 100 &&
    typeof item.savedAt === 'string' &&
    Number.isFinite(Date.parse(item.savedAt))
  );
};
export function readReceipts(): SavedReceipt[] {
  const items: unknown = JSON.parse(localStorage.getItem(key) || '[]');
  if (!Array.isArray(items) || items.length > 50 || !items.every(valid))
    throw new Error(
      'Danh sách lưu trên thiết bị không đọc được. Bạn vẫn có thể tra cứu bằng mã biên nhận.',
    );
  return items;
}
export function saveReceipt(item: SavedReceipt) {
  if (!valid(item)) throw new Error('Thông tin biên nhận không hợp lệ.');
  const previous = readReceipts().filter((value) => value.orderId !== item.orderId);
  if (previous.length >= 50)
    throw new Error('Đã lưu 50 biên nhận. Xóa một biên nhận cũ trước khi lưu thêm.');
  localStorage.setItem(key, JSON.stringify([item, ...previous]));
}
export function removeReceipt(orderId: string) {
  localStorage.setItem(
    key,
    JSON.stringify(readReceipts().filter((item) => item.orderId !== orderId)),
  );
}
export function clearReceipts() {
  localStorage.removeItem(key);
}
export function receiptLink(item: SavedReceipt) {
  return `/receipt#${new URLSearchParams({ order: item.orderId, token: item.token })}`;
}
