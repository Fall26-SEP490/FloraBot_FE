import type {
  CustomerKioskLocationItem,
  GoongPlaceDetail,
  GoongPrediction,
  PublicKioskDto,
} from './kiosk-location.types';
import { normalizePublicKiosk } from './kiosk-location.utils';

export async function fetchPublicKiosks(): Promise<CustomerKioskLocationItem[]> {
  const response = await fetch('/api/kiosks', {
    method: 'GET',
    credentials: 'omit',
    cache: 'no-store',
  });
  if (!response.ok) {
    const err = (await response.json().catch(() => ({}))) as {
      detail?: string;
      message?: string;
    };
    throw new Error(err.detail || err.message || 'Không thể tải danh sách kiosk.');
  }
  const payload = (await response.json()) as PublicKioskDto[];
  return payload.map(normalizePublicKiosk);
}

/**
 * Goong Places Autocomplete search
 * Uses NEXT_PUBLIC_GOONG_API_KEY
 */
export async function searchGoongPlaces(
  input: string,
  options?: { location?: { lat: number; lon: number }; radiusKm?: number },
): Promise<GoongPrediction[]> {
  const apiKey = process.env.NEXT_PUBLIC_GOONG_API_KEY?.trim();
  if (!apiKey || apiKey.length < 5 || !input.trim()) return [];

  const params = new URLSearchParams({
    api_key: apiKey,
    input: input.trim(),
    limit: '6',
  });

  if (options?.location) {
    params.set('location', `${options.location.lat},${options.location.lon}`);
    if (options.radiusKm) {
      params.set('radius', String(options.radiusKm * 1000));
    }
  }

  try {
    const res = await fetch(`https://rsapi.goong.io/Place/AutoComplete?${params.toString()}`);
    if (!res.ok) return [];
    const data = (await res.json()) as { status: string; predictions?: GoongPrediction[] };
    return data.status === 'OK' && Array.isArray(data.predictions) ? data.predictions : [];
  } catch {
    return [];
  }
}

/**
 * Fetch detailed coordinates for a selected Goong Place ID
 */
export async function getGoongPlaceDetail(placeId: string): Promise<GoongPlaceDetail | null> {
  const apiKey = process.env.NEXT_PUBLIC_GOONG_API_KEY?.trim();
  if (!apiKey || !placeId) return null;

  try {
    const res = await fetch(
      `https://rsapi.goong.io/Place/Detail?place_id=${encodeURIComponent(placeId)}&api_key=${apiKey}`,
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { status: string; result?: GoongPlaceDetail };
    return data.status === 'OK' && data.result ? data.result : null;
  } catch {
    return null;
  }
}
