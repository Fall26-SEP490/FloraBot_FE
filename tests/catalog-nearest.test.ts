import { describe, expect, it } from 'vitest';
import type { CatalogItem } from '../apps/web/src/features/catalog/catalog.types';
import { sortCatalogItems } from '../apps/web/src/features/catalog/catalog.utils';
import {
  catalogReturnPath,
  readCatalogQuery,
} from '../apps/web/src/features/catalog/catalog.navigation';

function flower(kioskId: string, productId: string, sellerId: string): CatalogItem {
  return {
    kioskId,
    productId,
    sellerId,
    shopName: sellerId,
    kioskName: kioskId,
    name: productId,
    description: null,
    price: 100000,
    address: '',
    photo: null,
    bouquets: [],
  };
}

describe('Catalog nearest sorting across shops', () => {
  it('orders all shops by kiosk distance without mutating the source list', () => {
    const far = flower('far', 'far-product', 'shop-A');
    const near = flower('near', 'near-product', 'shop-B');
    const unknown = flower('unknown', 'unknown-product', 'shop-C');
    const items = [unknown, far, near];
    const sorted = sortCatalogItems(
      items,
      'nearest',
      new Map([
        ['far', 9],
        ['near', 1],
      ]),
    );
    expect(sorted).toEqual([near, far, unknown]);
    expect(items).toEqual([unknown, far, near]);
  });

  it('puts invalid and missing distances after known distances', () => {
    const items = [
      flower('missing', 'p1', 'shop-A'),
      flower('negative', 'p2', 'shop-A'),
      flower('nan', 'p3', 'shop-B'),
      flower('known', 'p4', 'shop-C'),
    ];
    const result = sortCatalogItems(
      items,
      'nearest',
      new Map([
        ['negative', -1],
        ['nan', NaN],
        ['known', 2],
      ]),
    );
    expect(result[0].kioskId).toBe('known');
    expect(result).toHaveLength(4);
  });

  it('uses consistent kiosk and product ordering for equally distant kiosks', () => {
    const items = [
      flower('b', 'z', 'shop-A'),
      flower('a', 'z', 'shop-B'),
      flower('a', 'a', 'shop-B'),
    ];
    const result = sortCatalogItems(
      items,
      'nearest',
      new Map([
        ['a', 1],
        ['b', 1],
      ]),
    );
    expect(result.map((item) => [item.kioskId, item.productId])).toEqual([
      ['a', 'a'],
      ['a', 'z'],
      ['b', 'z'],
    ]);
  });

  it('keeps nearest sorting in catalog and detail return URLs', () => {
    expect(readCatalogQuery(new URLSearchParams('sort=nearest')).sortBy).toBe('nearest');
    expect(catalogReturnPath('/dat-hoa?sort=nearest&page=2')).toBe('/dat-hoa?sort=nearest&page=2');
  });
});
