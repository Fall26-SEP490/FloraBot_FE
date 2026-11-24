import { catalogReturnPath, isCatalogListingPath } from '../catalog/catalog.navigation';
import type { CustomerSellerChatItem } from './types';
import { orderReturnPath } from '../orders/order-navigation';

export function customerChatReturn(
  value: string | null,
): { href: string; label: string; kind: 'order' | 'product' | 'catalog' } | null {
  if (
    !value ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\') ||
    [...value].some((char) => char.charCodeAt(0) <= 32 || char.charCodeAt(0) === 127)
  )
    return null;
  const url = new URL(value, 'https://florabot.invalid');
  if (url.origin !== 'https://florabot.invalid') return null;
  if (isCatalogListingPath(url.pathname))
    return {
      href: catalogReturnPath(value),
      label: url.pathname === '/dat-hoa' ? 'Quay lại danh mục hoa' : 'Quay lại cửa hàng',
      kind: 'catalog',
    };
  if (/^\/dat-hoa\/[a-zA-Z0-9-]+\/[a-zA-Z0-9-]+$/.test(url.pathname)) {
    const params = new URLSearchParams();
    const from = url.searchParams.get('from');
    if (from) params.set('from', catalogReturnPath(from));
    const zone = url.searchParams.get('zone');
    if (zone && ['PREORDER', 'WALK_IN', 'UNKNOWN'].includes(zone)) params.set('zone', zone);
    return {
      href: url.pathname + (params.size ? '?' + params.toString() : ''),
      label: 'Quay lại mẫu hoa',
      kind: 'product',
    };
  }
  if (url.pathname === '/tai-khoan' && url.hash === '#web-orders') {
    const origin = orderReturnPath(value);
    if (!origin) return null;
    return {
      href: origin,
      label: 'Quay lại đơn đặt trước',
      kind: 'order',
    };
  }
  return null;
}

export function customerConversationHref(chatId: string, returnTo: string | null = null) {
  const params = new URLSearchParams({ chat: chatId });
  const origin = customerChatReturn(returnTo);
  if (origin) params.set('chatReturn', origin.href);
  return `/tai-khoan?${params}#member-chats`;
}

export function rememberOpenedCustomerChat(chat: CustomerSellerChatItem) {
  try {
    sessionStorage.setItem(
      'florabot_opened_chat',
      JSON.stringify({
        id: chat.id,
        otherPartyName: chat.otherPartyName,
        productContext: chat.productContext,
        createdAt: chat.createdAt,
      }),
    );
  } catch {
    // Opening the conversation still works when storage is unavailable.
  }
}
