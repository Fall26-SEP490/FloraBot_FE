import { afterEach, describe, expect, it, vi } from 'vitest';
import { validateMessageContent } from '../apps/web/src/features/chat/api';
import {
  getStaffMessages,
  openStaffChatForSeller,
  openStaffChatForStaff,
  sendStaffMessage,
  staffChatTransport,
  validateStaffMessage,
} from '../apps/web/src/features/chat/staffChatApi';

afterEach(() => vi.unstubAllGlobals());

describe('Private seller-staff API contract', () => {
  it('allows internal contact details while retaining customer-chat restrictions', () => {
    const text = 'Gọi 0901234567, gửi ảnh tới shop@example.vn hoặc https://example.vn';
    expect(validateStaffMessage(text, false)).toBeNull();
    expect(validateMessageContent(text, false)).not.toBeNull();
    expect(validateStaffMessage(' ', false)).not.toBeNull();
    expect(validateStaffMessage(' ', true)).toBeNull();
    expect(validateStaffMessage('a'.repeat(2000), false)).toBeNull();
    expect(validateStaffMessage('a'.repeat(2001), false)).not.toBeNull();
  });

  it('opens a seller conversation in its authenticated shop and staff conversation with no body', async () => {
    const fetch = vi
      .fn()
      .mockImplementation(() => Promise.resolve(new Response('{}', { status: 200 })));
    vi.stubGlobal('fetch', fetch);
    await openStaffChatForSeller('shop-1', 'staff-1');
    await openStaffChatForStaff();
    expect(fetch.mock.calls[0][0]).toBe('/api/sellers/shop-1/staff/staff-1/chat/open');
    expect(fetch.mock.calls[1][0]).toBe('/api/staff/chats/open');
    expect(fetch.mock.calls[1][1]).toMatchObject({
      method: 'POST',
      body: undefined,
      credentials: 'include',
    });
  });

  it('uses private history, message, and raw upload endpoints', async () => {
    const fetch = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(
          new Response(JSON.stringify({ reference: 'evidence:v1:fixture' }), { status: 200 }),
        ),
      );
    vi.stubGlobal('fetch', fetch);
    await getStaffMessages('chat-1', 2);
    await sendStaffMessage('chat-1', { content: '  Gọi 0901234567  ' });
    await staffChatTransport.upload(
      'chat-1',
      new File(['png'], 'sample.png', { type: 'image/png' }),
    );
    expect(fetch.mock.calls[0][0]).toBe('/api/seller-staff/chats/chat-1/messages?page=2');
    expect(fetch.mock.calls[1][0]).toBe('/api/seller-staff/chats/chat-1/messages');
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({
      content: 'Gọi 0901234567',
      imageReference: null,
    });
    expect(fetch.mock.calls[2][0]).toBe('/api/seller-staff/chats/chat-1/images');
    expect(fetch.mock.calls[2][1]).toMatchObject({
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'image/png' },
    });
  });
});
