import { describe, expect, it } from 'vitest';
import {
  customerChatReturn,
  customerConversationHref,
} from '../apps/web/src/features/chat/customer-chat.navigation';

describe('Customer chat return navigation', () => {
  it('preserves an order, its page and filter without carrying unrelated parameters', () => {
    expect(
      customerChatReturn(
        '/tai-khoan?requestId=order-1&page=2&filter=ready&token=private#web-orders',
      ),
    ).toEqual({
      href: '/tai-khoan?requestId=order-1&page=2&filter=ready#web-orders',
      label: 'Quay lại đơn đặt trước',
      kind: 'order',
    });
  });
  it('preserves catalog state and a product return path', () => {
    const from = '/dat-hoa?search=hong&price=under300&page=2';
    expect(customerChatReturn(from)?.href).toBe(from);
    expect(
      customerChatReturn(
        '/dat-hoa/p-1/k-1?from=' + encodeURIComponent(from) + '&zone=PREORDER&order=1',
      )?.href,
    ).toBe('/dat-hoa/p-1/k-1?from=' + encodeURIComponent(from) + '&zone=PREORDER');
  });
  it.each([
    null,
    'https://evil.test/',
    '//evil.test/',
    '/\\evil.test',
    '/admin',
    '/receipt?token=private',
    '/tai-khoan#overview',
    '/tai-khoan#web-orders',
    '/tai-khoan?requestId=%3Cscript%3E#web-orders',
    '/dat-hoa\n',
  ])('rejects invalid or unrelated destination %s', (value) => {
    expect(customerChatReturn(value)).toBeNull();
  });
  it('drops invalid pages, filters and unsafe nested destinations', () => {
    expect(
      customerChatReturn('/tai-khoan?requestId=order-1&page=-2&filter=unknown#web-orders')?.href,
    ).toBe('/tai-khoan?requestId=order-1#web-orders');
    expect(
      customerChatReturn('/dat-hoa/p-1/k-1?from=https%3A%2F%2Fevil.test&zone=FAKE')?.href,
    ).toBe('/dat-hoa/p-1/k-1?from=%2Fdat-hoa');
  });
  it('always opens messages directly and encodes the return as a single local parameter', () => {
    const url = new URL(
      customerConversationHref('chat-1', '/tai-khoan?requestId=order-1&page=2#web-orders'),
      'https://florabot.invalid',
    );
    expect(url.pathname).toBe('/tai-khoan');
    expect(url.hash).toBe('#member-chats');
    expect(url.searchParams.get('chat')).toBe('chat-1');
    expect(url.searchParams.get('chatReturn')).toBe(
      '/tai-khoan?requestId=order-1&page=2#web-orders',
    );
    expect(customerConversationHref('chat-1', 'https://evil.test')).toBe(
      '/tai-khoan?chat=chat-1#member-chats',
    );
  });
});
