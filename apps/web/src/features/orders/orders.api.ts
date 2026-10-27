import type { components } from '../../../../../packages/contracts/src/generated/api';
import { request } from '../../api';
import type { OrderPage } from './orders.types';

export async function fetchWebOrders(base: string, page: number): Promise<OrderPage> {
  return request<OrderPage>(`${base}?page=${page}`);
}

export async function sendOrderAction(
  base: string,
  orderId: string,
  kind: string,
  body: unknown,
): Promise<{ checkoutUrl?: string }> {
  return request<{ checkoutUrl?: string }>(`${base}/${orderId}/${kind}`, body);
}

export async function returnFlowersToSeller(
  sellerId: string,
  payload: components['schemas']['ReturnToSellerRequest'],
): Promise<unknown> {
  return request(`/sellers/${sellerId}/flows/return_to_seller`, payload);
}
