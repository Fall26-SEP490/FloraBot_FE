import type { components } from '../../../../../packages/contracts/src/generated/api';

export type Profile = {
  id: string;
  fullName: string;
  email: string | null;
  loyaltyPoints: number;
};

export type CustomerHistoryItem = components['schemas']['CustomerHistoryItem'];
export type CustomerHistoryPage = components['schemas']['CustomerHistoryPage'];

export type TabKey =
  'overview' | 'profile' | 'chats' | 'orders' | 'history' | 'kiosks' | 'security' | 'shop';

export const TAB_HASH_MAP: Record<string, TabKey> = {
  overview: 'overview',
  'member-profile': 'profile',
  'member-chats': 'chats',
  'web-orders': 'orders',
  'member-orders': 'history',
  'member-kiosks': 'kiosks',
  'member-security': 'security',
  'member-shop': 'shop',
};

export const TAB_TO_HASH: Record<TabKey, string> = {
  overview: 'overview',
  profile: 'member-profile',
  chats: 'member-chats',
  orders: 'web-orders',
  history: 'member-orders',
  kiosks: 'member-kiosks',
  security: 'member-security',
  shop: 'member-shop',
};

export const ORDER_STATUS_LABELS: Record<string, string> = {
  AWAITING_PAYMENT: 'Chờ thanh toán',
  PAID: 'Đã thanh toán',
  DISPENSING: 'Đang nhận hoa',
  COMPLETED: 'Đã nhận hoa',
  CANCELLED: 'Đã hủy',
  EXPIRED: 'Hết hạn thanh toán',
  DISPENSE_FAILED: 'Đang xử lý sự cố',
  REFUNDED: 'Đã hoàn tiền',
  DISPUTED: 'Đang xử lý phản ánh',
};
