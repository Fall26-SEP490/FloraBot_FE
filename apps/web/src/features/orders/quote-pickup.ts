import { vietnamDateTime, vietnamDateTimeToUtc } from '@/shared/lib/vietnam-date';

const hourMs = 60 * 60 * 1000;
const windowMs = 30 * 24 * hourMs;

export function sellerQuotePickupError(value: string, now = Date.now()): string | null {
  let pickup: number;
  try {
    pickup = Date.parse(vietnamDateTimeToUtc(value));
  } catch {
    return 'Chọn ngày và giờ nhận hợp lệ.';
  }
  const delay = pickup - now;
  if (delay < hourMs) return 'Giờ nhận phải cách lúc gửi báo giá ít nhất 1 giờ.';
  if (delay > windowMs) return 'Giờ nhận không được quá 30 ngày kể từ lúc gửi báo giá.';
  return null;
}

export function sellerQuotePickupBounds(now = Date.now()) {
  return {
    min: vietnamDateTime(new Date(Math.ceil((now + hourMs) / 60000) * 60000)),
    max: vietnamDateTime(new Date(now + windowMs)),
  };
}
