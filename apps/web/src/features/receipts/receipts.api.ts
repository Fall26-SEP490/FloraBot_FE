import type { components } from '../../../../../packages/contracts/src/generated/api';
import type { ReceiptData } from './receipts.types';

export async function lookupReceipt(
  orderId: string,
  token: string,
  signal?: AbortSignal,
): Promise<ReceiptData> {
  const response = await fetch('/api/receipts/lookup', {
    method: 'POST',
    credentials: 'omit',
    cache: 'no-store',
    referrerPolicy: 'no-referrer',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      orderId: orderId.trim(),
      token: token.trim().toUpperCase(),
    }),
    signal,
  });

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => ({}))) as {
      detail?: string;
      message?: string;
    };
    throw new Error(
      errorBody.detail || errorBody.message || 'Không tìm thấy biên nhận khớp thông tin đã nhập.',
    );
  }

  return (await response.json()) as ReceiptData;
}

export async function submitReceiptComplaint(
  body: components['schemas']['OpenDisputeRequest'],
  signal?: AbortSignal,
): Promise<Response> {
  return fetch('/api/receipts/flows/open_dispute', {
    method: 'POST',
    credentials: 'omit',
    cache: 'no-store',
    referrerPolicy: 'no-referrer',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
}
