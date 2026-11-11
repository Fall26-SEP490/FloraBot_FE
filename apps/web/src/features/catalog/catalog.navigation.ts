import type { AvailabilityFilter, PriceFilter, SortOption } from './catalog.types';

export const catalogQueryKeys = [
  'search',
  'price',
  'occasion',
  'shop',
  'kiosk',
  'mode',
  'sort',
  'page',
  'demo',
] as const;
export function readCatalogQuery(params: URLSearchParams) {
  const pick = <T extends string>(key: string, values: readonly T[], fallback: T): T => {
    const value = params.get(key);
    return values.includes(value as T) ? (value as T) : fallback;
  };
  const text = (key: string) =>
    (params.get(key) ?? '')
      .split('')
      .filter((char) => char.charCodeAt(0) >= 32 && char.charCodeAt(0) !== 127)
      .join('')
      .slice(0, 200);
  const page = Number(params.get('page'));
  return {
    search: text('search'),
    priceFilter: pick<PriceFilter>(
      'price',
      ['all', 'under300', '300to600', '600to1000', 'over1000'],
      'all',
    ),
    availabilityFilter: pick<AvailabilityFilter>('mode', ['all', 'stock', 'custom'], 'all'),
    sortBy: pick<SortOption>(
      'sort',
      ['default', 'price-asc', 'price-desc', 'name-asc', 'nearest'],
      'default',
    ),
    occasionFilter: text('occasion') || 'all',
    shopFilter: text('shop') || 'all',
    kioskFilter: text('kiosk') || 'all',
    page: Number.isSafeInteger(page) && page > 0 && page <= 100000 ? page : 1,
  };
}

/** Only catalog state may be carried back from a product; never arbitrary destinations. */
export function catalogReturnPath(value: string | null): string {
  if (
    !value ||
    !/^\/dat-hoa(?:\?|$)/.test(value) ||
    /[\\#]/.test(value) ||
    [...value].some((char) => char.charCodeAt(0) < 32)
  )
    return '/dat-hoa';
  const query = value.split('?')[1] ?? '';
  const params = new URLSearchParams(query);
  if (
    [...params.keys()].some(
      (key) =>
        !catalogQueryKeys.includes(key as (typeof catalogQueryKeys)[number]) ||
        params.getAll(key).length !== 1,
    )
  )
    return '/dat-hoa';
  const state = readCatalogQuery(params);
  const clean = new URLSearchParams();
  for (const [key, val] of Object.entries({
    search: state.search,
    price: state.priceFilter,
    occasion: state.occasionFilter,
    shop: state.shopFilter,
    kiosk: state.kioskFilter,
    mode: state.availabilityFilter,
    sort: state.sortBy,
    page: String(state.page),
  })) {
    if (val && val !== 'all' && val !== 'default' && !(key === 'page' && val === '1'))
      clean.set(key, val);
  }
  if (params.get('demo') === '1' || params.get('demo') === 'true') clean.set('demo', '1');
  return '/dat-hoa' + (clean.size ? '?' + clean.toString() : '');
}
