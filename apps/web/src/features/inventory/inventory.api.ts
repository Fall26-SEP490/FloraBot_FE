import type { components } from '../../../../../packages/contracts/src/generated/api';
import { request } from '../../api';
import type { Accessory, SellerKiosk, Slot, StaffStockOptions } from './inventory.types';

export async function fetchSellerKiosksForInventory(sellerId: string): Promise<SellerKiosk[]> {
  return request<SellerKiosk[]>(`/sellers/${sellerId}/kiosks`);
}

export async function fetchSellerSlots(sellerId: string, kioskId: string): Promise<Slot[]> {
  return request<Slot[]>(`/sellers/${sellerId}/kiosks/${kioskId}/slots`);
}

export async function stockSlot(
  sellerId: string,
  payload: components['schemas']['StockBouquetRequest'],
): Promise<unknown> {
  return request(`/sellers/${sellerId}/flows/stock_slot`, payload);
}

export async function fetchSellerAccessories(sellerId: string): Promise<Accessory[]> {
  return request<Accessory[]>(`/sellers/${sellerId}/accessories`);
}

export async function restockAccessory(
  sellerId: string,
  payload: components['schemas']['RestockAccessoryRequest'],
): Promise<unknown> {
  return request(`/sellers/${sellerId}/flows/restock_accessory`, payload, false);
}

export async function fetchStaffStockOptions(path: string): Promise<StaffStockOptions> {
  return request<StaffStockOptions>(path);
}

export async function submitStaffStockAction(path: string, payload: unknown): Promise<unknown> {
  return request(path, payload);
}
