import type { components } from '../../../../../packages/contracts/src/generated/api';

export type SellerKioskDto = components['schemas']['SellerKioskDto'];
export type SellerKioskItem = SellerKioskDto & { slotCount?: number };
export type UpdateKioskLocationPayload = components['schemas']['UpdateKioskLocationRequest'] & {
  reason?: string;
};

export interface KioskLocationChangeResponse {
  id: string;
  kioskId: string;
  sellerId: string;
  address: string;
  latitude: number;
  longitude: number;
  reason: string;
  status: string;
  createdAt: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
}

export type AdminKioskResponse = components['schemas']['AdminKioskResponse'];
export type AdminSellerResponse = components['schemas']['AdminSellerResponse'];
export type AssignKioskRequest = components['schemas']['AssignKioskRequest'];
