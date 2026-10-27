import type { components } from '../../../../../packages/contracts/src/generated/api';

export type ReceiptData = components['schemas']['ReceiptResponse'];

export type SavedReceipt = {
  orderId: string;
  token: string;
  orderCode: string;
  savedAt: string;
};
