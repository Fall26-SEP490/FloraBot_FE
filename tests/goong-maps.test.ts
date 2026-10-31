import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  getMapTileConfig,
  buildGoongDirectionsUrl,
} from '../apps/web/src/features/kiosk-location/kiosk-location.utils';
import {
  fetchGoongPlacePredictions,
  fetchGoongPlaceDetail,
} from '../apps/web/src/features/kiosk-location/kiosk-location.api';

describe('Goong Maps helper unit tests', () => {
  const originalKey = process.env.NEXT_PUBLIC_GOONG_MAPTILES_KEY;

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalKey === undefined) {
      delete process.env.NEXT_PUBLIC_GOONG_MAPTILES_KEY;
    } else {
      process.env.NEXT_PUBLIC_GOONG_MAPTILES_KEY = originalKey;
    }
  });

  it('falls back to OpenStreetMap when Goong Map Tiles key is not configured', () => {
    delete process.env.NEXT_PUBLIC_GOONG_MAPTILES_KEY;
    const config = getMapTileConfig();
    expect(config.isGoong).toBe(false);
    expect(config.tileUrl).toContain('tile.openstreetmap.org');
    expect(config.attribution).toContain('OpenStreetMap');
    expect(config.maxZoom).toBe(19);
  });

  it('uses Goong Map Tiles when valid key is provided', () => {
    process.env.NEXT_PUBLIC_GOONG_MAPTILES_KEY = 'test_goong_maptiles_key_12345';
    const config = getMapTileConfig();
    expect(config.isGoong).toBe(true);
    expect(config.styleUrl).toBe(
      'https://tiles.goong.io/assets/goong_map_web.json?api_key=test_goong_maptiles_key_12345',
    );
    expect(config.tileUrl).toBe(config.styleUrl);
    expect(config.attribution).toContain('Goong Maps');
    expect(config.maxZoom).toBe(20);
  });

  it('builds Goong Maps directions URL correctly', () => {
    const destUrl = buildGoongDirectionsUrl(10.7822, 106.6955);
    expect(destUrl).toBe('https://maps.goong.io/?destination=10.7822,106.6955');

    const routeUrl = buildGoongDirectionsUrl(10.7822, 106.6955, 10.7626, 106.6825);
    expect(routeUrl).toBe(
      'https://maps.goong.io/?origin=10.7626,106.6825&destination=10.7822,106.6955',
    );
  });

  it('does not call Goong AutoComplete when input has fewer than 3 characters', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const result = await fetchGoongPlacePredictions('ab');
    expect(result).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('parses Goong AutoComplete predictions and Place Detail coordinates', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/Place/AutoComplete')) {
        return new Response(
          JSON.stringify({
            status: 'OK',
            predictions: [
              {
                place_id: 'place-123',
                description: '123 Nguyễn Huệ, Bến Nghé, Quận 1, TP.HCM',
                structured_formatting: {
                  main_text: '123 Nguyễn Huệ',
                  secondary_text: 'Bến Nghé, Quận 1, TP.HCM',
                },
              },
            ],
          }),
          { status: 200 },
        );
      }
      return new Response(
        JSON.stringify({
          status: 'OK',
          result: {
            place_id: 'place-123',
            name: '123 Nguyễn Huệ',
            formatted_address: '123 Nguyễn Huệ, Bến Nghé, Quận 1, TP.HCM',
            geometry: { location: { lat: 10.776889, lng: 106.700806 } },
          },
        }),
        { status: 200 },
      );
    });

    const predictions = await fetchGoongPlacePredictions('123 Nguyễn');
    expect(predictions).toHaveLength(1);
    expect(predictions[0]?.place_id).toBe('place-123');

    const detail = await fetchGoongPlaceDetail('place-123');
    expect(detail.geometry.location).toEqual({ lat: 10.776889, lng: 106.700806 });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
