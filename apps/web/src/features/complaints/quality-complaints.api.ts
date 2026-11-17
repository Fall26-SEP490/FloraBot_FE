import { ApiError } from '@/shared/lib/api';
import type { components } from '../../../../../packages/contracts/src/generated/api';

export type QualitySchema = components['schemas'];
export type QualityComplaint = QualitySchema['QualityComplaintDetail'];
export type ReceiptCapability = QualitySchema['ReceiptLookupRequest'];

export const qualityLabels: Record<string, string> = {
  REPORTED: 'Chờ shop tiếp nhận',
  ACCEPTED: 'Shop đã tiếp nhận',
  IN_PROGRESS: 'Đang kiểm tra',
  REVIEW_REQUIRED: 'Shop đang xem báo cáo',
  REPLACEMENT_READY: 'Hoa thay đã sẵn sàng',
  ATTENTION_REQUIRED: 'Shop cần xử lý tiếp',
  REFUND_REVIEW: 'Chờ xét duyệt hoàn tiền',
  RESOLVED: 'Đã xử lý',
  PLANNED: 'Chờ nạp hoa thay',
  LOADED: 'Đã nạp, chờ shop duyệt',
  READY: 'Sẵn sàng nhận hoa thay',
  COLLECTED: 'Đã nhận hoa thay',
  EXPIRED: 'Đã hết hạn nhận hoa thay',
  CANCELLED: 'Đã hủy phương án thay hoa',
};

export function qualityDate(value: string) {
  return new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
}

export async function lookupQuality(
  capability: ReceiptCapability,
  evidencePage: number,
  signal?: AbortSignal,
) {
  const response = await fetch(`/api/receipts/complaints/lookup?evidencePage=${evidencePage}`, {
    method: 'POST',
    credentials: 'omit',
    cache: 'no-store',
    referrerPolicy: 'no-referrer',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(capability),
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(15_000)])
      : AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new ApiError(response.status, 'Chưa tải được tiến độ phản ánh.');
  return response.json() as Promise<QualityComplaint>;
}
