import { z } from 'zod';

export const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const numberValue = z
  .union([z.number(), z.string().trim().min(1)])
  .transform(Number)
  .pipe(z.number().finite());
const packageSchema = z.object({
  id: z.string().regex(GUID_PATTERN),
  name: z.string().min(1),
  annualFee: numberValue.pipe(z.number().int().nonnegative()),
  totalSlots: numberValue.pipe(z.number().int().positive()),
  termMonths: numberValue.pipe(z.number().int().positive()),
  status: z.string(),
  description: z.string(),
});
const locationSchema = z.object({
  id: z.string().regex(GUID_PATTERN),
  code: z.string().min(1),
  name: z.string().min(1),
  address: z.string().min(1),
  region: z.string(),
  status: z.string(),
  latitude: numberValue.pipe(z.number().min(-90).max(90)),
  longitude: numberValue.pipe(z.number().min(-180).max(180)),
  directionsUrl: z.string().nullish(),
});
const flowerSchema = z.object({
  productId: z.string().regex(GUID_PATTERN),
  sellerId: z.string().regex(GUID_PATTERN),
  kioskId: z.string().regex(GUID_PATTERN),
  name: z.string().min(1),
  shopName: z.string(),
  kioskName: z.string(),
  address: z.string(),
  description: z.string().nullish(),
  price: numberValue.pipe(z.number().nonnegative()),
  photo: z.string().nullish(),
});
export type LandingPackage = z.infer<typeof packageSchema>;
export type LandingLocation = z.infer<typeof locationSchema>;
export type LandingFlower = z.infer<typeof flowerSchema>;
export type LocationsState = { items: LandingLocation[]; error: boolean };
export const parsePackages = (value: unknown) =>
  z
    .array(packageSchema)
    .parse(value)
    .filter((plan) => plan.status === 'ACTIVE');
export const parseLocations = (value: unknown) => z.array(locationSchema).parse(value);
export const parseCatalogPage = (value: unknown) =>
  z
    .object({
      items: z.array(flowerSchema),
      page: z.number().int().positive(),
      hasMore: z.boolean(),
    })
    .parse(value);
export function resolvePackageId(plans: LandingPackage[], id: string) {
  return plans.some((plan) => plan.id === id) ? id : '';
}
export const priceVnd = (amount: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
export function safePublicUrl(value?: string | null) {
  if (!value) return null;
  if (value.startsWith('/') && !value.startsWith('//') && !value.includes('\\')) return value;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}
export function kioskDirections(kiosk: LandingLocation) {
  return (
    safePublicUrl(kiosk.directionsUrl) ||
    `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${kiosk.latitude},${kiosk.longitude}`)}`
  );
}
export function budgetSuggestions(items: LandingFlower[], budget: number) {
  const distinct = new Map(items.map((item) => [`${item.productId}:${item.kioskId}`, item]));
  return [...distinct.values()]
    .filter((item) => item.price <= budget)
    .sort((a, b) => a.price - b.price)
    .slice(0, 3);
}
export function createRegistrationSchema(plans: LandingPackage[]) {
  return z.object({
    shopName: z
      .string()
      .trim()
      .min(2, 'Nhập tên shop từ 2 ký tự.')
      .max(120, 'Tên shop tối đa 120 ký tự.'),
    phone: z
      .string()
      .regex(/^(0[35789][0-9]{8}|\+84[35789][0-9]{8})$/, 'Nhập số điện thoại Việt Nam hợp lệ.'),
    area: z.string().trim().min(2, 'Nhập khu vực của shop.').max(200, 'Khu vực tối đa 200 ký tự.'),
    packageId: z
      .string()
      .regex(GUID_PATTERN, 'Chọn gói bạn quan tâm.')
      .refine((id) => !!resolvePackageId(plans, id), 'Gói không còn khả dụng. Vui lòng chọn lại.'),
    website: z.string().max(0).optional(),
  });
}
export type LandingRegistrationInput = z.infer<ReturnType<typeof createRegistrationSchema>>;
