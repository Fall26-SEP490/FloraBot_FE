import { describe, expect, it } from 'vitest';
import {
  computeFilterCounts,
  canOrderOnWeb,
  isWalkIn,
  purchaseLabel,
  filterCatalogItems,
  formatPrice,
  matchesAvailability,
  matchesPrice,
  matchesSearch,
  sortCatalogItems,
  uniqueCatalogCards,
} from '../apps/web/src/features/catalog/catalog.utils';
import type { CatalogItem } from '../apps/web/src/features/catalog/catalog.types';
import { readCatalogQuery } from '../apps/web/src/features/catalog/catalog.navigation';

const sampleItem = (overrides?: Partial<CatalogItem>): CatalogItem => ({
  productId: 'prod-1',
  sellerId: 'seller-1',
  shopName: 'Hoa Sài Gòn',
  name: 'Bó Hồng Pastel',
  description: 'Hoa tặng sinh nhật nhẹ nhàng',
  price: 350000,
  kioskId: 'kiosk-1',
  kioskName: 'Kiosk NVH Thanh Niên',
  address: 'Quận 1, TP.HCM',
  photo: null,
  bouquets: ['bq-1'],
  tags: ['flower:rose'],
  ...overrides,
});

it('shows one preorder card per shop product and keeps walk-in cards by kiosk', () => {
  const preorder = sampleItem({ zone: 'PREORDER' });
  const walkIn = sampleItem({ zone: 'WALK_IN' });
  const secondKiosk = { kioskId: 'kiosk-2', kioskName: 'Kiosk 2' };
  const anotherShop = sampleItem({ sellerId: 'seller-2' });
  const items = [
    preorder,
    { ...preorder, ...secondKiosk },
    walkIn,
    { ...walkIn, ...secondKiosk },
    anotherShop,
  ];

  expect(uniqueCatalogCards(items)).toEqual([preorder, walkIn, items[3], anotherShop]);
  expect(computeFilterCounts(items).availabilityCounts).toEqual({ custom: 2, stock: 2 });
});

describe('Catalog Utilities - Price boundaries', () => {
  it.each([
    [99999, 'under100'],
    [100000, '100to200'],
    [200000, '100to200'],
    [200001, 'over200'],
  ])('puts %i đ in exactly one current range', (price, expected) => {
    const ranges = ['under100', '100to200', 'over200'] as const;
    expect(ranges.filter((range) => matchesPrice(price, range))).toEqual([expected]);
  });

  it('correctly handles under300 tier (< 300.000đ)', () => {
    expect(matchesPrice(299999, 'under300')).toBe(true);
    expect(matchesPrice(300000, 'under300')).toBe(false);
  });

  it('verifies a 600.000đ product belongs to only one range (300to600 and NOT 600to1000)', () => {
    expect(matchesPrice(600000, '300to600')).toBe(true);
    expect(matchesPrice(600000, '600to1000')).toBe(false);
    expect(matchesPrice(600001, '600to1000')).toBe(true);
  });

  it('correctly handles 1.000.000đ and over1000 tier', () => {
    expect(matchesPrice(1000000, '600to1000')).toBe(true);
    expect(matchesPrice(1000000, 'over1000')).toBe(false);
    expect(matchesPrice(1000001, 'over1000')).toBe(true);
  });

  it('returns true for "all" filter', () => {
    expect(matchesPrice(50000, 'all')).toBe(true);
    expect(matchesPrice(2000000, 'all')).toBe(true);
  });
});

it('ignores retired occasion links and validates supported flower types', () => {
  expect(readCatalogQuery(new URLSearchParams('occasion=BIRTHDAY')).flowerFilter).toBe('all');
  expect(readCatalogQuery(new URLSearchParams('flower=tulip')).flowerFilter).toBe('tulip');
  expect(readCatalogQuery(new URLSearchParams('flower=invalid')).flowerFilter).toBe('all');
});

describe('Catalog Utilities - Search matching', () => {
  it('matches by product name, shop name, kiosk name, address or description', () => {
    const item = sampleItem();
    expect(matchesSearch(item, 'Pastel')).toBe(true);
    expect(matchesSearch(item, 'Sài Gòn')).toBe(true);
    expect(matchesSearch(item, 'Thanh Niên')).toBe(true);
    expect(matchesSearch(item, 'Quận 1')).toBe(true);
    expect(matchesSearch(item, 'nhẹ nhàng')).toBe(true);
    expect(matchesSearch(item, 'hoa cúc')).toBe(false);
  });

  it('returns true when search query is empty or whitespace', () => {
    const item = sampleItem();
    expect(matchesSearch(item, '')).toBe(true);
    expect(matchesSearch(item, '   ')).toBe(true);
  });
});

describe('Catalog Utilities - Availability matching', () => {
  it('uses the sales channel rather than bouquet count', () => {
    expect(matchesAvailability(sampleItem(), 'stock')).toBe(false);
    expect(matchesAvailability(sampleItem(), 'custom')).toBe(true);
    expect(matchesAvailability(sampleItem({ bouquets: [] }), 'stock')).toBe(false);
    expect(matchesAvailability(sampleItem({ bouquets: [] }), 'custom')).toBe(true);
    expect(matchesAvailability(sampleItem(), 'all')).toBe(true);
    expect(matchesAvailability(sampleItem({ zone: 'WALK_IN', bouquets: [] }), 'custom')).toBe(
      false,
    );
  });
});

describe('Catalog purchase channels', () => {
  it('allows PREORDER, blocks WALK_IN regardless of stock and rejects unknown zones', () => {
    for (const bouquets of [[], ['b1']]) {
      expect(canOrderOnWeb(sampleItem({ zone: 'PREORDER', bouquets }))).toBe(true);
      const walkIn = sampleItem({ zone: 'WALK_IN', bouquets });
      expect(canOrderOnWeb(walkIn)).toBe(false);
      expect(isWalkIn(walkIn)).toBe(true);
      expect(purchaseLabel(walkIn)).toBe('Chỉ mua tại kiosk');
    }
    expect(canOrderOnWeb(sampleItem({ zone: 'UNKNOWN' }))).toBe(false);
  });

  it('preserves web catalog stock eligibility guaranteed by the endpoint', () => {
    expect(canOrderOnWeb(sampleItem({ bouquets: [] }))).toBe(true);
    expect(canOrderOnWeb(sampleItem())).toBe(true);
    expect(isWalkIn(sampleItem())).toBe(false);
    expect(purchaseLabel(sampleItem())).toBe('Đặt trước');
  });
});

describe('Catalog Utilities - Sorting', () => {
  const items = [
    sampleItem({ name: 'Hoa Cúc', price: 200000 }),
    sampleItem({ name: 'Hoa Hồng', price: 500000 }),
    sampleItem({ name: 'Hoa Lan', price: 100000 }),
  ];

  it('sorts by price-asc', () => {
    const sorted = sortCatalogItems(items, 'price-asc');
    expect(sorted.map((i) => i.price)).toEqual([100000, 200000, 500000]);
  });

  it('sorts by price-desc', () => {
    const sorted = sortCatalogItems(items, 'price-desc');
    expect(sorted.map((i) => i.price)).toEqual([500000, 200000, 100000]);
  });

  it('sorts by name-asc using Vietnamese locale', () => {
    const sorted = sortCatalogItems(items, 'name-asc');
    expect(sorted.map((i) => i.name)).toEqual(['Hoa Cúc', 'Hoa Hồng', 'Hoa Lan']);
  });
});

describe('Catalog Utilities - Combined filtering and counts', () => {
  const items = [
    sampleItem({ productId: '1', price: 250000, bouquets: ['b1'] }),
    sampleItem({
      productId: '2',
      price: 450000,
      bouquets: [],
      tags: ['hoa hồng', 'FLOWER:ROSE'],
    }),
    sampleItem({
      productId: '3',
      price: 800000,
      tags: ['flower:sunflower'],
      description: 'Hoa chúc mừng tốt nghiệp',
      bouquets: ['b2'],
    }),
  ];

  it('counts each orderable template once when another kiosk is sold out', () => {
    const orderable = sampleItem({
      zone: 'PREORDER',
      preorderAvailable: true,
      tags: ['occasion:birthday', 'Sinh nhật'],
      kioskId: 'kiosk-2',
    });
    const catalog = [
      { ...orderable, kioskId: 'kiosk-1', preorderAvailable: false },
      orderable,
      { ...orderable, kioskId: 'kiosk-3' },
      sampleItem({ zone: 'WALK_IN' }),
    ];
    expect(computeFilterCounts(catalog)).toMatchObject({
      preorderAvailableCount: 1,
      occasions: [{ id: 'occasion:birthday', label: 'Sinh nhật', count: 1 }],
    });
    expect(
      filterCatalogItems(catalog, {
        search: '',
        priceFilter: 'over200',
        preorderOnly: true,
        tags: ['occasion:birthday'],
        shopFilter: 'all',
        kioskFilter: 'all',
        availabilityFilter: 'all',
      }),
    ).toEqual(catalog.slice(1, 3));
  });

  it('filters by flower type and price simultaneously', () => {
    const filtered = filterCatalogItems(items, {
      search: '',
      priceFilter: 'under300',
      flowerFilter: 'rose',
      shopFilter: 'all',
      kioskFilter: 'all',
      availabilityFilter: 'all',
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].productId).toBe('1');
  });

  it('computes aggregation counts correctly', () => {
    const counts = computeFilterCounts(items);
    expect(counts.flowerCounts.rose).toBe(2);
    expect(counts.flowerCounts.sunflower).toBe(1);
    expect(counts.priceCounts.under300).toBe(1);
    expect(counts.priceCounts['300to600']).toBe(1);
    expect(counts.priceCounts['600to1000']).toBe(1);
    expect(counts.availabilityCounts.stock).toBe(0);
    expect(counts.availabilityCounts.custom).toBe(3);
  });

  it('formats price', () => {
    expect(formatPrice(350000)).toBe('350.000');
  });
});
