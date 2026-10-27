import { describe, it, expect } from 'vitest';
import {
  parseCoordinate,
  isValidLatitude,
  isValidLongitude,
  getKioskStatusLabel,
  isKioskActive,
  buildGoogleMapsDirectionsUrl,
  buildGoogleMapsSearchUrl,
} from '../apps/web/src/features/kiosk-location/kiosk-location.utils';

describe('kioskTypes coordinates and URL helpers', () => {
  it('does NOT coerce blank or whitespace to 0', () => {
    expect(parseCoordinate('')).toBeNull();
    expect(parseCoordinate('   ')).toBeNull();
    expect(parseCoordinate('\t\n')).toBeNull();
    expect(parseCoordinate(null)).toBeNull();
    expect(parseCoordinate(undefined)).toBeNull();
  });

  it('correctly parses valid numeric strings and numbers', () => {
    expect(parseCoordinate('0')).toBe(0);
    expect(parseCoordinate('10.7822')).toBe(10.7822);
    expect(parseCoordinate('-10.7822')).toBe(-10.7822);
    expect(parseCoordinate(10.7822)).toBe(10.7822);
    expect(parseCoordinate(0)).toBe(0);
  });

  it('rejects invalid or non-finite inputs', () => {
    expect(parseCoordinate('abc')).toBeNull();
    expect(parseCoordinate('12.34.56')).toBeNull();
    expect(parseCoordinate(NaN)).toBeNull();
    expect(parseCoordinate(Infinity)).toBeNull();
    expect(parseCoordinate(-Infinity)).toBeNull();
  });

  it('validates latitude bounds [-90, 90]', () => {
    expect(isValidLatitude(0)).toBe(true);
    expect(isValidLatitude(90)).toBe(true);
    expect(isValidLatitude(-90)).toBe(true);
    expect(isValidLatitude(10.7822)).toBe(true);
    expect(isValidLatitude(90.0001)).toBe(false);
    expect(isValidLatitude(-90.0001)).toBe(false);
    expect(isValidLatitude(null)).toBe(false);
  });

  it('validates longitude bounds [-180, 180]', () => {
    expect(isValidLongitude(0)).toBe(true);
    expect(isValidLongitude(180)).toBe(true);
    expect(isValidLongitude(-180)).toBe(true);
    expect(isValidLongitude(106.6955)).toBe(true);
    expect(isValidLongitude(180.0001)).toBe(false);
    expect(isValidLongitude(-180.0001)).toBe(false);
    expect(isValidLongitude(null)).toBe(false);
  });

  it('builds Google Maps directions URL with api=1 and destination coordinates without API key', () => {
    const url = buildGoogleMapsDirectionsUrl(10.7822, 106.6955);
    expect(url).toContain('https://www.google.com/maps/dir/?api=1&destination=');
    expect(url).toContain('10.7822');
    expect(url).toContain('106.6955');
    expect(url).not.toContain('key=');
  });

  it('builds Google Maps search URL with api=1 and query coordinates without API key', () => {
    const url = buildGoogleMapsSearchUrl(10.7822, 106.6955);
    expect(url).toContain('https://www.google.com/maps/search/?api=1&query=');
    expect(url).toContain('10.7822');
    expect(url).toContain('106.6955');
    expect(url).not.toContain('key=');
  });

  it('correctly labels status per contract: only ONLINE/ACTIVE active, MAINTENANCE is Bảo trì', () => {
    expect(getKioskStatusLabel('ONLINE')).toBe('Đang hoạt động');
    expect(getKioskStatusLabel('ACTIVE')).toBe('Đang hoạt động');
    expect(getKioskStatusLabel('MAINTENANCE')).toBe('Bảo trì');
    expect(getKioskStatusLabel('OFFLINE')).toBe('Ngoại tuyến');

    expect(isKioskActive('ONLINE')).toBe(true);
    expect(isKioskActive('ACTIVE')).toBe(true);
    expect(isKioskActive('MAINTENANCE')).toBe(false);
    expect(isKioskActive('OFFLINE')).toBe(false);
  });

  it('differentiates coordinate 0 from missing or blank value', () => {
    const parsedZero = parseCoordinate('0');
    expect(parsedZero).toBe(0);
    expect(isValidLatitude(parsedZero)).toBe(true);
    expect(isValidLongitude(parsedZero)).toBe(true);

    const parsedBlank = parseCoordinate('   ');
    expect(parsedBlank).toBeNull();
    expect(isValidLatitude(parsedBlank)).toBe(false);
    expect(isValidLongitude(parsedBlank)).toBe(false);
  });
});
