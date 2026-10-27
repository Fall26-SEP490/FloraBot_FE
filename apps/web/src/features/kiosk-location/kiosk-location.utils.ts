import { GOONG_ATTRIBUTION, OSM_ATTRIBUTION, OSM_TILE_URL } from './kiosk-location.constants';
import type {
  CustomerKioskLocationItem,
  GoongMapTileConfig,
  PublicKioskDto,
} from './kiosk-location.types';

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

/**
 * Returns the active map tile configuration.
 * Uses Goong Maps if NEXT_PUBLIC_GOONG_MAPTILES_KEY is configured in .env.local;
 * otherwise safely falls back to OpenStreetMap.
 */
export function getMapTileConfig(): GoongMapTileConfig {
  const goongMapTilesKey = process.env.NEXT_PUBLIC_GOONG_MAPTILES_KEY?.trim();

  if (goongMapTilesKey && goongMapTilesKey.length > 5 && !goongMapTilesKey.startsWith('YOUR_')) {
    const style = `https://tiles.goong.io/assets/goong_map_web.json?api_key=${goongMapTilesKey}`;
    return {
      isGoong: true,
      styleUrl: style,
      tileUrl: style,
      attribution: GOONG_ATTRIBUTION,
      maxZoom: 20,
      minZoom: 4,
    };
  }

  // Fallback to OpenStreetMap
  return {
    isGoong: false,
    styleUrl: OSM_TILE_URL,
    tileUrl: OSM_TILE_URL,
    attribution: OSM_ATTRIBUTION,
    maxZoom: 19,
    minZoom: 4,
  };
}

/**
 * Build external navigation directions URL
 * Generates Goong Maps web route if requested, or standard Google Maps
 */
export function buildGoongDirectionsUrl(
  destLat: number,
  destLon: number,
  originLat?: number,
  originLon?: number,
): string {
  if (originLat !== undefined && originLon !== undefined) {
    return `https://maps.goong.io/?origin=${originLat},${originLon}&destination=${destLat},${destLon}`;
  }
  return `https://maps.goong.io/?destination=${destLat},${destLon}`;
}
