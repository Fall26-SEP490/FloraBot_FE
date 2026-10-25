import { describe, it, expect, afterEach } from 'vitest';
import { getMapTileConfig, buildGoongDirectionsUrl } from '../apps/web/src/goongMaps';

describe('Goong Maps helper unit tests', () => {
  const originalKey = process.env.NEXT_PUBLIC_GOONG_MAPTILES_KEY;

  afterEach(() => {
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
});
