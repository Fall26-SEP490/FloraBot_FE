import { expect, it, vi } from 'vitest';
import { loadCatalog } from '../apps/web/src/features/catalog/catalog.data';
import type { CatalogItem } from '../apps/web/src/features/catalog/catalog.types';
import { filterCatalogItems } from '../apps/web/src/features/catalog/catalog.utils';

it('finds a walk-in item on a later API page before filtering', async () => {
  const item = {
    productId: 'p',
    kioskId: 'k',
    name: 'Hoa',
    shopName: 'Shop',
    kioskName: 'Kiosk',
    address: '',
    price: 100,
    bouquets: ['b'],
    description: '',
    sellerId: 's',
    photo: null,
    zone: 'PREORDER',
  } satisfies CatalogItem;
  const fetchPage = vi.fn(async (page: number) => ({
    items: page === 1 ? [item] : [{ ...item, zone: 'WALK_IN' }],
    page,
    hasMore: page === 1,
  }));
  const items = await loadCatalog(fetchPage);
  const matches = filterCatalogItems(items, {
    search: '',
    priceFilter: 'all',
    occasionFilter: 'all',
    shopFilter: 'all',
    kioskFilter: 'all',
    availabilityFilter: 'stock',
  });
  expect(fetchPage).toHaveBeenCalledTimes(2);
  expect(matches.map((item) => item.zone)).toEqual(['WALK_IN']);
});

it('does not present a partial catalog as complete when a later page fails', async () => {
  await expect(
    loadCatalog(async (page) => {
      if (page === 2) throw new Error('offline');
      return { items: [], page, hasMore: true };
    }),
  ).rejects.toThrow('offline');
});
