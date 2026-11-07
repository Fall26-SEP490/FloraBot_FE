import { z } from 'zod';
import { request } from '@/shared/lib/api';

const rawSchema = z.object({
  annualSlotPrice: z.number().int().positive().nullable().optional(),
  walkInAnnualPrice: z.number().int().positive().nullable().optional(),
  preorderAnnualPrice: z.number().int().positive().nullable().optional(),
  version: z.number().int().nonnegative(),
  configured: z.boolean(),
  updatedAt: z.string().nullable(),
  termMonths: z.literal(12),
  minSlots: z.literal(1),
  maxSlots: z.literal(50),
});

const schema = rawSchema.transform((raw) => {
  const unitPrice = raw.annualSlotPrice ?? raw.walkInAnnualPrice ?? raw.preorderAnnualPrice ?? null;
  return {
    annualSlotPrice: unitPrice,
    walkInAnnualPrice: raw.walkInAnnualPrice ?? unitPrice,
    preorderAnnualPrice: raw.preorderAnnualPrice ?? unitPrice,
    version: raw.version,
    configured: raw.configured,
    updatedAt: raw.updatedAt,
    termMonths: raw.termMonths,
    minSlots: raw.minSlots,
    maxSlots: raw.maxSlots,
  };
});

export type KioskSlotPricing = z.infer<typeof schema>;
export const kioskPricingKey = ['kiosk-slot-pricing'];

export const kioskPricingQuery = {
  queryKey: kioskPricingKey,
  queryFn: async () => schema.parse(await request<unknown>('/kiosk-packages')),
};
export function pricingReady(pricing?: KioskSlotPricing | null) {
  return !!(
    pricing?.configured &&
    pricing.version > 0 &&
    pricing.annualSlotPrice != null &&
    pricing.annualSlotPrice > 0
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
  const walkPrice = pricing!.walkInAnnualPrice ?? pricing!.annualSlotPrice!;
  const prePrice = pricing!.preorderAnnualPrice ?? pricing!.annualSlotPrice!;
  const total = walk * walkPrice + preorder * prePrice;
  return Number.isSafeInteger(total) ? total : null;
}
export const rentalMoney = (value: number | string) =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(Number(value));
