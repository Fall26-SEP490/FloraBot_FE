import { z } from 'zod';
import { request } from '@/shared/lib/api';

export type KioskSlotPricing = z.infer<typeof schema>;
export const kioskPricingKey = ['kiosk-slot-pricing'];
const schema = z.object({
  walkInAnnualPrice: z.number().int().positive().nullable(),
  preorderAnnualPrice: z.number().int().positive().nullable(),
  version: z.number().int().nonnegative(),
  configured: z.boolean(),
  updatedAt: z.string().nullable(),
  termMonths: z.literal(12),
  minSlots: z.literal(1),
  maxSlots: z.literal(50),
});
export const kioskPricingQuery = {
  queryKey: kioskPricingKey,
  queryFn: async () => schema.parse(await request<unknown>('/kiosk-packages')),
};
export function pricingReady(pricing?: KioskSlotPricing | null) {
  return !!(
    pricing?.configured &&
    pricing.version > 0 &&
    pricing.walkInAnnualPrice != null &&
    pricing.walkInAnnualPrice > 0 &&
    pricing.preorderAnnualPrice != null &&
    pricing.preorderAnnualPrice > 0
  );
}
export function validSlotDemand(walk: number, preorder: number) {
  return (
    Number.isInteger(walk) &&
    Number.isInteger(preorder) &&
    walk >= 0 &&
    preorder >= 0 &&
    walk + preorder >= 1 &&
    walk + preorder <= 50
  );
}
export function rentalTotal(
  pricing: KioskSlotPricing | null | undefined,
  walk: number,
  preorder: number,
) {
  if (!pricingReady(pricing) || !validSlotDemand(walk, preorder)) return null;
  const total = walk * pricing!.walkInAnnualPrice! + preorder * pricing!.preorderAnnualPrice!;
  return Number.isSafeInteger(total) ? total : null;
}
export const rentalMoney = (value: number | string) =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(Number(value));
