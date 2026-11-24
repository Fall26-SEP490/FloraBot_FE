import type { AvailabilityFilter, PriceFilter, SortOption } from './catalog.types';
import { flowerTags } from '@/shared/lib/flower-tags';
import { readCatalogTags } from './catalog.tags';
import { PRICE_FILTER_IDS, RATING_FILTER_IDS } from './catalog.constants';

const sellerIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const shopCatalogPrefix = '/dat-hoa/cua-hang/';

export function shopCatalogPath(sellerId: string) {
  return sellerIdPattern.test(sellerId) ? shopCatalogPrefix + sellerId.toLowerCase() : null;
}

export function shopCatalogSellerId(pathname: string) {
  const id = pathname.slice(shopCatalogPrefix.length);
  return pathname.startsWith(shopCatalogPrefix) && sellerIdPattern.test(id)
    ? id.toLowerCase()
    : null;
}

export function isCatalogListingPath(pathname: string) {
  return pathname === '/dat-hoa' || shopCatalogSellerId(pathname) !== null;
}

export const catalogQueryKeys = [
  'search',
  'price',
  'preorder',
  'productRating',
  'shopRating',
  'flower',
  'tag',
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
    priceFilter: pick<PriceFilter>('price', PRICE_FILTER_IDS, 'all'),
    preorderOnly: params.get('preorder') === '1',
    productRating: pick('productRating', RATING_FILTER_IDS, 'all'),
    shopRating: pick('shopRating', RATING_FILTER_IDS, 'all'),
    availabilityFilter: pick<AvailabilityFilter>('mode', ['all', 'stock', 'custom'], 'all'),
    sortBy: pick<SortOption>(
      'sort',
      ['default', 'price-asc', 'price-desc', 'name-asc', 'nearest'],
      'default',
    ),
    flowerFilter: pick('flower', ['all', ...Object.keys(flowerTags)], 'all'),
    tags: readCatalogTags(params.getAll('tag')),
    shopFilter: text('shop') || 'all',
    kioskFilter: text('kiosk') || 'all',
    page: Number.isSafeInteger(page) && page > 0 && page <= 100000 ? page : 1,
  };
}

/** Only catalog state may be carried back from a product; never arbitrary destinations. */
export function catalogReturnPath(value: string | null): string {
  if (!value || /[\\#]/.test(value) || [...value].some((char) => char.charCodeAt(0) < 32))
    return '/dat-hoa';
  const separator = value.indexOf('?');
  const pathname = separator === -1 ? value : value.slice(0, separator);
  if (!isCatalogListingPath(pathname)) return '/dat-hoa';
  const query = separator === -1 ? '' : value.slice(separator + 1);
  const params = new URLSearchParams(query);
  if (
    [...params.keys()].some(
      (key) =>
        !catalogQueryKeys.includes(key as (typeof catalogQueryKeys)[number]) ||
        (key !== 'tag' && params.getAll(key).length !== 1),
    )
  )
    return '/dat-hoa';
  const state = readCatalogQuery(params);
  const clean = new URLSearchParams();
  for (const [key, val] of Object.entries({
    search: state.search,
    price: state.priceFilter,
    preorder: state.preorderOnly ? '1' : '',
    productRating: state.productRating,
    shopRating: state.shopRating,
    flower: state.flowerFilter,
    shop: state.shopFilter,
    kiosk: state.kioskFilter,
    mode: state.availabilityFilter,
    sort: state.sortBy,
    page: String(state.page),
  })) {
    if (val && val !== 'all' && val !== 'default' && !(key === 'page' && val === '1'))
      clean.set(key, val);
  }
  state.tags.forEach((tag) => clean.append('tag', tag));
  if (params.get('demo') === '1' || params.get('demo') === 'true') clean.set('demo', '1');
  return pathname + (clean.size ? '?' + clean.toString() : '');
}

export function catalogOriginPath(current: URL) {
  return catalogReturnPath(
    isCatalogListingPath(current.pathname)
      ? current.pathname + current.search
      : current.searchParams.get('from'),
  );
}
