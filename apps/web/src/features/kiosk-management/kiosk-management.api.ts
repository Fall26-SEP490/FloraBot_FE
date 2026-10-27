import type { components } from '../../../../../packages/contracts/src/generated/api';
import { request } from '../../api';
import type { SellerKioskItem, UpdateKioskLocationPayload } from './kiosk-management.types';

export async function fetchSellerKiosks(sellerId: string): Promise<SellerKioskItem[]> {
  return request<SellerKioskItem[]>(`/sellers/${sellerId}/kiosks`);
}

export async function updateKioskLocation(
  sellerId: string,
  kioskId: string,
  payload: UpdateKioskLocationPayload,
): Promise<SellerKioskItem> {
  return request<SellerKioskItem>(
    `/sellers/${sellerId}/kiosks/${kioskId}/location`,
    payload,
    false,
    'PUT',
  );
}

export async function assignKioskToSeller(
  payload: components['schemas']['AssignKioskRequest'],
): Promise<unknown> {
  return request('/admin/flows/assign_kiosk', payload);
}
