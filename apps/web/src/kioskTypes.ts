import type { components } from '../../../packages/contracts/src/generated/api';

export type KioskCoordinates = components['schemas']['KioskCoordinates'];
export type SellerKioskDto = components['schemas']['SellerKioskDto'];
export type SellerKioskItem = SellerKioskDto;
export type UpdateKioskLocationPayload = components['schemas']['UpdateKioskLocationRequest'];
export type PublicKioskDto = components['schemas']['PublicKioskDto'];
export type CustomerKioskLocationItem = Omit<
  PublicKioskDto,
  'code' | 'name' | 'address' | 'region' | 'status' | 'latitude' | 'longitude'
> & {
  code: string;
  name: string;
  address: string;
  region: string;
  status: string;
  latitude: number | null;
  longitude: number | null;
};
export type CustomerKioskLocationsResponse = CustomerKioskLocationItem[];

export function normalizePublicKiosk(kiosk: PublicKioskDto): CustomerKioskLocationItem {
  return {
    ...kiosk,
    code: kiosk.code?.trim() ?? '',
    name: kiosk.name?.trim() ?? '',
    address: kiosk.address?.trim() ?? '',
    region: kiosk.region?.trim() ?? '',
    status: kiosk.status?.trim() ?? 'UNKNOWN',
    latitude: parseCoordinate(kiosk.latitude),
    longitude: parseCoordinate(kiosk.longitude),
  };
}

export function getKioskStatusLabel(status: string): string {
  switch (status) {
    case 'ONLINE':
    case 'ACTIVE':
      return 'Đang hoạt động';
    case 'MAINTENANCE':
      return 'Bảo trì';
    case 'OFFLINE':
      return 'Ngoại tuyến';
    case 'DISABLED':
      return 'Vô hiệu hóa';
    default:
      return status;
  }
}

export function isKioskActive(status: string): boolean {
  return status === 'ONLINE' || status === 'ACTIVE';
}

export function parseCoordinate(val: unknown): number | null {
  if (typeof val === 'number') {
    return Number.isFinite(val) ? val : null;
  }
  if (typeof val !== 'string') return null;
  const trimmed = val.trim();
  if (!trimmed) return null;
  const num = Number(trimmed);
  if (!Number.isFinite(num)) return null;
  return num;
}

export function isValidLatitude(val: unknown): val is number {
  return typeof val === 'number' && Number.isFinite(val) && val >= -90 && val <= 90;
}

export function isValidLongitude(val: unknown): val is number {
  return typeof val === 'number' && Number.isFinite(val) && val >= -180 && val <= 180;
}

export function buildGoogleMapsDirectionsUrl(lat: number, lon: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${lat},${lon}`)}`;
}

export function buildGoogleMapsSearchUrl(lat: number, lon: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lon}`)}`;
}
