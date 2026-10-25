/**
 * Goong Maps integration helper for FloraBot
 * Supports:
 * 1. Goong Map Style / Vector Tiles via MapLibre GL
 * 2. Goong Places Autocomplete & Geocoding REST APIs
 * 3. Graceful fallback to OpenStreetMap when Goong Map Tiles key is absent
 */

export interface GoongMapTileConfig {
  isGoong: boolean;
  styleUrl: string;
  tileUrl: string;
  attribution: string;
  subdomains?: string;
  maxZoom: number;
  minZoom: number;
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
      attribution:
        'Dữ liệu bản đồ © <a href="https://www.goong.io" target="_blank" rel="noopener noreferrer">Goong Maps</a> · <a href="https://maplibre.org" target="_blank" rel="noopener noreferrer">MapLibre</a>',
      maxZoom: 20,
      minZoom: 4,
    };
  }

  // Fallback to OpenStreetMap
  const osmUrl = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  return {
    isGoong: false,
    styleUrl: osmUrl,
    tileUrl: osmUrl,
    attribution:
      'Dữ liệu bản đồ © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> · <a href="https://leafletjs.com" target="_blank" rel="noopener noreferrer">Leaflet</a>',
    maxZoom: 19,
    minZoom: 4,
  };
}

export interface GoongPrediction {
  description: string;
  place_id: string;
  structured_formatting?: {
    main_text: string;
    secondary_text: string;
  };
}

export interface GoongPlaceDetail {
  place_id: string;
  name: string;
  formatted_address: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
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
