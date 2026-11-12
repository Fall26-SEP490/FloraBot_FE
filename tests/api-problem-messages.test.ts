import { afterEach, describe, expect, it, vi } from 'vitest';
import { request } from '../apps/web/src/shared/lib/api';

afterEach(() => vi.unstubAllGlobals());

describe('Backend problem messages', () => {
  it.each([
    [
      { title: 'Cấu hình kênh đã thay đổi. Cần gắn lại phiên bản mới.' },
      'Cấu hình kênh đã thay đổi. Cần gắn lại phiên bản mới.',
    ],
    [
      { title: 'Không thể lưu trữ', detail: 'Kiosk còn kỳ thuê đang hoạt động.' },
      'Kiosk còn kỳ thuê đang hoạt động.',
    ],
    [
      { title: 'Bad Request', errors: { secretRef: ['Mã tham chiếu không hợp lệ.'] } },
      'Mã tham chiếu không hợp lệ.',
    ],
    [
      { title: 'Payment unavailable', detail: 'missing_seller_channel' },
      'Shop chưa cấu hình kênh nhận tiền PayOS. Bạn chưa bị tính tiền; vui lòng liên hệ shop.',
    ],
    [
      {
        title: 'Số tài khoản nhận tiền tại cổng thanh toán không khớp với tài khoản người bán.',
        detail: 'receiver_account_mismatch',
      },
      'Số tài khoản nhận tiền tại cổng thanh toán không khớp với tài khoản người bán.',
    ],
    [{}, 'Chưa xử lý được yêu cầu. Bạn thử lại nhé.'],
  ])('uses the most useful error from %j', async (problem, message) => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(problem), { status: 503 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(
      request('/sellers/test/payment-channel/verify', {}, false, 'POST'),
    ).rejects.toMatchObject({ status: 503, message });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
