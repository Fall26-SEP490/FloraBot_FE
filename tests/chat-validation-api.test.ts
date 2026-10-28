import { describe, expect, it } from 'vitest';
import {
  containsContactInfo,
  formatChatError,
  validateChatImageFile,
  validateMessageContent,
} from '../apps/web/src/features/chat/api';
import { ApiError } from '../apps/web/src/shared/lib/api';

describe('Chat text validation', () => {
  it('rejects empty content when there is no image', () => {
    expect(validateMessageContent('', false)).toContain('Vui lòng nhập nội dung');
    expect(validateMessageContent('   ', false)).toContain('Vui lòng nhập nội dung');
  });

  it('allows empty text content if an image is attached', () => {
    expect(validateMessageContent('', true)).toBeNull();
    expect(validateMessageContent('   ', true)).toBeNull();
  });

  it('allows valid normal message text', () => {
    expect(
      validateMessageContent('Chào shop, mình muốn hỏi bó hoa này còn không?', false),
    ).toBeNull();
  });

  it('rejects messages longer than 2000 characters', () => {
    const longText = 'a'.repeat(2001);
    expect(validateMessageContent(longText, false)).toContain('tối đa 2000 ký tự');
  });

  it('allows messages with exactly 2000 characters', () => {
    const text2000 = 'a'.repeat(2000);
    expect(validateMessageContent(text2000, false)).toBeNull();
  });

  it('detects and rejects email addresses in message text', () => {
    expect(containsContactInfo('Liên hệ mình qua email test@gmail.com nhé')).toBe(true);
    expect(validateMessageContent('test@gmail.com', false)).toContain('không được chứa email');
  });

  it('detects and rejects phone numbers in message text', () => {
    expect(containsContactInfo('Số mình là 0912345678')).toBe(true);
    expect(containsContactInfo('+84912345678')).toBe(true);
    expect(validateMessageContent('Gọi 0901234567 nhé', false)).toContain(
      'không được chứa email, số điện thoại',
    );
  });

  it('detects and rejects URLs and links in message text', () => {
    expect(containsContactInfo('Xem thêm tại https://example.com/flower')).toBe(true);
    expect(containsContactInfo('Ghé www.florabot.vn nhé')).toBe(true);
    expect(validateMessageContent('Link https://facebook.com nè', false)).toContain(
      'không được chứa email, số điện thoại hoặc đường dẫn',
    );
  });
});

describe('Chat image validation', () => {
  it('allows PNG, JPEG, and WebP images under 5 MB', () => {
    const validPng = new File(['binary content'], 'photo.png', { type: 'image/png' });
    const validJpeg = new File(['binary content'], 'photo.jpg', { type: 'image/jpeg' });
    const validWebp = new File(['binary content'], 'photo.webp', { type: 'image/webp' });

    expect(validateChatImageFile(validPng)).toBeNull();
    expect(validateChatImageFile(validJpeg)).toBeNull();
    expect(validateChatImageFile(validWebp)).toBeNull();
  });

  it('rejects unsupported MIME types', () => {
    const gifFile = new File(['binary content'], 'photo.gif', { type: 'image/gif' });
    const pdfFile = new File(['binary content'], 'doc.pdf', { type: 'application/pdf' });
    const exeFile = new File(['binary content'], 'test.exe', { type: 'application/octet-stream' });

    expect(validateChatImageFile(gifFile)).toContain('Định dạng ảnh không được hỗ trợ');
    expect(validateChatImageFile(pdfFile)).toContain('Định dạng ảnh không được hỗ trợ');
    expect(validateChatImageFile(exeFile)).toContain('Định dạng ảnh không được hỗ trợ');
  });

  it('rejects 0-byte empty files', () => {
    const emptyFile = new File([], 'empty.png', { type: 'image/png' });
    expect(validateChatImageFile(emptyFile)).toContain('không có dữ liệu');
  });

  it('rejects files exceeding 5 MB', () => {
    const oversized = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'big.png', {
      type: 'image/png',
    });
    expect(validateChatImageFile(oversized)).toContain('vượt quá kích thước 5 MB');
  });
});

describe('Chat error formatting', () => {
  it('formats specific HTTP status codes with user-friendly messages', () => {
    expect(formatChatError(new ApiError(400, 'Tùy chỉnh'))).toBe('Tùy chỉnh');
    expect(formatChatError(new ApiError(401, ''))).toContain('Phiên đăng nhập đã hết hạn');
    expect(formatChatError(new ApiError(403, ''))).toContain('không có quyền');
    expect(formatChatError(new ApiError(404, ''))).toContain(
      'Cuộc trò chuyện hoặc đối phương không tồn tại',
    );
    expect(formatChatError(new ApiError(409, ''))).toContain('Xung đột');
    expect(formatChatError(new ApiError(413, ''))).toContain('5 MB');
    expect(formatChatError(new ApiError(415, ''))).toContain('Định dạng ảnh không được hỗ trợ');
    expect(formatChatError(new ApiError(429, ''))).toContain('Bạn thao tác quá nhanh');
    expect(formatChatError(new ApiError(503, ''))).toContain(
      'Dịch vụ chat hoặc kho lưu trữ tạm thời gián đoạn',
    );
  });

  it('handles AbortError and standard Error', () => {
    const abortErr = new Error('The operation was aborted');
    abortErr.name = 'AbortError';
    expect(formatChatError(abortErr)).toContain('bị hủy hoặc hết thời gian');

    const genericErr = new Error('Lỗi mạng kết nối');
    expect(formatChatError(genericErr)).toBe('Lỗi mạng kết nối');
  });
});
