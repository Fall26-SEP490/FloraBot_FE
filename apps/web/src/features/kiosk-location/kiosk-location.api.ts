import type {
  CustomerKioskLocationItem,
  GoongPlaceDetail,
  GoongPrediction,
  PublicKioskDto,
} from './kiosk-location.types';
import {
  getGoongApiKey,
  isValidLatitude,
  isValidLongitude,
  normalizePublicKiosk,
} from './kiosk-location.utils';

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

/**
 * Goong Places Autocomplete search with explicit error propagation and AbortSignal support.
 * Endpoint: https://rsapi.goong.io/Place/AutoComplete
 */
export async function fetchGoongPlacePredictions(
  input: string,
  options?: {
    location?: { lat: number; lon: number };
    radiusKm?: number;
    signal?: AbortSignal;
  },
): Promise<GoongPrediction[]> {
  const trimmed = input.trim();
  if (trimmed.length < 3) return [];

  const apiKey = getGoongApiKey();
  const params = new URLSearchParams({
    input: trimmed,
    limit: '6',
  });
  if (apiKey) {
    params.set('api_key', apiKey);
  }
  if (options?.location) {
    params.set('location', `${options.location.lat},${options.location.lon}`);
    if (options.radiusKm) {
      params.set('radius', String(options.radiusKm * 1000));
    }
  }

  const res = await fetch(`https://rsapi.goong.io/Place/AutoComplete?${params.toString()}`, {
    method: 'GET',
    signal: options?.signal,
  });

  if (!res.ok) {
    throw new Error('Không thể tải gợi ý địa chỉ lúc này.');
  }

  const data = (await res.json()) as {
    status?: string;
    predictions?: GoongPrediction[];
  };

  if (data.status === 'OK') {
    return Array.isArray(data.predictions) ? data.predictions : [];
  }

  if (
    data.status === 'ZERO_RESULTS' ||
    (data.status === undefined && Array.isArray(data.predictions) && data.predictions.length === 0)
  ) {
    return [];
  }

  throw new Error('Không thể tải gợi ý địa chỉ lúc này.');
}

/**
 * Fetch detailed coordinates for a selected Goong Place ID with explicit error propagation.
 * Endpoint: https://rsapi.goong.io/Place/Detail
 */
export async function fetchGoongPlaceDetail(
  placeId: string,
  options?: { signal?: AbortSignal },
): Promise<GoongPlaceDetail> {
  const trimmedPlaceId = placeId.trim();
  if (!trimmedPlaceId) {
    throw new Error('Mã địa điểm không hợp lệ.');
  }

  const apiKey = getGoongApiKey();
  const params = new URLSearchParams({
    place_id: trimmedPlaceId,
  });
  if (apiKey) {
    params.set('api_key', apiKey);
  }

  const res = await fetch(`https://rsapi.goong.io/Place/Detail?${params.toString()}`, {
    method: 'GET',
    signal: options?.signal,
  });

  if (!res.ok) {
    throw new Error('Không lấy được tọa độ của địa chỉ đã chọn.');
  }

  const data = (await res.json()) as {
    status?: string;
    result?: GoongPlaceDetail;
  };

  const lat = data.result?.geometry?.location?.lat;
  const lng = data.result?.geometry?.location?.lng;

  if (data.status === 'OK' && data.result && isValidLatitude(lat) && isValidLongitude(lng)) {
    return data.result;
  }

  throw new Error('Không lấy được tọa độ của địa chỉ đã chọn.');
}
