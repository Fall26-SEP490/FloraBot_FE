import { describe, expect, it } from 'vitest';
import fixture from './fixtures/landing-api-data.json';
import {
  parsePackages,
  parseLocations,
  parseCatalogPage,
  resolvePackageId,
  createRegistrationSchema,
  budgetSuggestions,
  kioskDirections,
  safePublicUrl,
  priceVnd,
} from '../apps/web/src/features/marketing/landing-data';

describe('Landing API mapping', () => {
  const plans = parsePackages(fixture.packages);
  const values = {
    shopName: 'Hoa API',
    phone: '0901234567',
    area: 'Hà Nội',
    packageId: plans[0].id,
    website: '',
  };
  it('maps annualFee and totalSlots without monthly conversion or old constants', () => {
    expect(plans[0]).toMatchObject({ annualFee: 770000, totalSlots: 7, termMonths: 18 });
    expect(priceVnd(plans[0].annualFee)).toContain('770.000');
  });
  it('preserves BE seed GUIDs and filters inactive packages', () => {
    expect(plans[0].id).toBe(fixture.packages[0].id);
    expect(parsePackages([{ ...fixture.packages[0], status: 'INACTIVE' }])).toEqual([]);
  });
  it('keeps asynchronous selection only if its ID exists in the current response', () => {
    expect(resolvePackageId([], plans[1].id)).toBe('');
    expect(resolvePackageId(plans, plans[1].id)).toBe(plans[1].id);
    expect(resolvePackageId(plans.slice(0, 1), plans[1].id)).toBe('');
  });
  it('registration accepts API IDs and rejects fake, previous default and removed IDs', () => {
    expect(createRegistrationSchema(plans).safeParse(values).success).toBe(true);
    for (const id of ['fake', '', '20000000-0000-0000-0000-00000000000a'])
      expect(createRegistrationSchema(plans).safeParse({ ...values, packageId: id }).success).toBe(
        false,
      );
    expect(createRegistrationSchema([]).safeParse(values).success).toBe(false);
  });
  it('validates actual contact fields and honeypot without requiring unrelated data', () => {
    expect(createRegistrationSchema(plans).parse({ ...values, shopName: ' Hoa API ' })).toEqual(
      values,
    );
    expect(createRegistrationSchema(plans).safeParse({ ...values, phone: 'abc' }).success).toBe(
      false,
    );
    expect(createRegistrationSchema(plans).safeParse({ ...values, website: 'spam' }).success).toBe(
      false,
    );
  });
  it('locations retain real coordinates and the provided directions URL', () => {
    const places = parseLocations(fixture.locations);
    expect(places.map((item) => [item.id, item.latitude, item.longitude])).toEqual(
      fixture.locations.map((item) => [item.id, item.latitude, item.longitude]),
    );
    expect(kioskDirections(places[0])).toBe(fixture.locations[0].directionsUrl);
    expect(() => parseLocations([{ ...fixture.locations[0], latitude: null }])).toThrow();
  });
  it('does not invent coordinates, fees or stock when payloads are invalid', () => {
    expect(() => parsePackages([{ ...fixture.packages[0], annualFee: null }])).toThrow();
    expect(() => parsePackages([{ ...fixture.packages[0], totalSlots: '' }])).toThrow();
    expect(() => parseCatalogPage({ items: [], page: 1 })).toThrow();
  });
  it('maps catalog price and photo without fabricating tags or occasions', () => {
    const page = parseCatalogPage({ items: fixture.catalog, page: 1, hasMore: true });
    expect(page.items[0].price).toBe(111000);
    expect(page.items[0].photo).toBe(fixture.catalog[0].photo);
    expect(page.items[0]).not.toHaveProperty('tags');
    expect(page.items[0]).not.toHaveProperty('occasion');
  });
  it('suggests by loaded prices and respects product plus kiosk identity', () => {
    const items = parseCatalogPage({ items: fixture.catalog, page: 1, hasMore: false }).items;
    expect(budgetSuggestions(items, 120000).map((item) => item.name)).toEqual([
      'Mẫu API 4',
      'Mẫu API 1',
    ]);
    expect(budgetSuggestions([], 999999)).toEqual([]);
    expect(budgetSuggestions([...items, items[0]], 120000)).toHaveLength(2);
  });
  it('rejects executable image and directions URLs', () => {
    expect(safePublicUrl('javascript:alert(1)')).toBeNull();
    expect(safePublicUrl('//evil.test/a')).toBeNull();
    expect(safePublicUrl('/images/sample.webp')).toBe('/images/sample.webp');
  });
});
