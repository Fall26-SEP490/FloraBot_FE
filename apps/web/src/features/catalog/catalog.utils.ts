import { getFlowerTypeCodes } from '@/shared/lib/flower-tags';
import { getCatalogItemTags, getCatalogTagGroup, readCatalogTags } from './catalog.tags';
import { PRICE_FILTERS, PRICE_FILTER_IDS } from './catalog.constants';
import type {
  AvailabilityCounts,
  AvailabilityFilter,
  CatalogItem,
  PriceFilter,
  SortOption,
} from './catalog.types';

export function isWalkIn(item: Pick<CatalogItem, 'zone'>): boolean {
  return item.zone === 'WALK_IN';
}

export function isPreorder(item: Pick<CatalogItem, 'zone'>): boolean {
  // /shop/catalog reads v_web_catalog: its bouquet IDs already exclude WALK_IN.
  // An explicit zone takes precedence if the API includes kiosk-only entries.
  return item.zone == null || item.zone === 'PREORDER';
}

type CatalogCardItem = Pick<CatalogItem, 'sellerId' | 'productId' | 'kioskId' | 'zone'>;

export function catalogCardKey(item: CatalogCardItem): string {
  const product = `${item.sellerId}:${item.productId}`;
  return isPreorder(item) ? `${product}:PREORDER` : `${product}:${item.kioskId}:${item.zone}`;
}

export function uniqueCatalogCards<T extends CatalogCardItem>(items: readonly T[]): T[] {
  const cards = new Map<string, T>();
  for (const item of items) {
    const key = catalogCardKey(item);
    if (!cards.has(key)) cards.set(key, item);
  }
  return [...cards.values()];
}

type PreorderStatus = Pick<CatalogItem, 'zone' | 'preorderAvailable'>;

export function isPreorderSoldOut(item: PreorderStatus): boolean {
  return isPreorder(item) && item.preorderAvailable === false;
}

export function canOrderOnWeb(item: PreorderStatus): boolean {
  return isPreorder(item) && !isPreorderSoldOut(item);
}

export function purchaseLabel(item: PreorderStatus): string {
  if (isWalkIn(item)) return 'Chỉ mua tại kiosk';
  if (isPreorderSoldOut(item)) return 'Hết hàng';
  return isPreorder(item) ? 'Đặt trước' : 'Chưa xác định hình thức mua';
}

export function matchesSearch(item: CatalogItem, query: string): boolean {
  if (!query.trim()) return true;
  const q = query.toLowerCase();
  return (
    item.name.toLowerCase().includes(q) ||
    item.shopName.toLowerCase().includes(q) ||
    item.kioskName.toLowerCase().includes(q) ||
    item.address.toLowerCase().includes(q) ||
    (item.description?.toLowerCase().includes(q) ?? false)
  );
}

export function matchesPrice(price: number, filter: PriceFilter): boolean {
  return PRICE_FILTERS[filter].matches(price);
}

export function matchesAvailability(item: CatalogItem, filter: AvailabilityFilter): boolean {
  if (filter === 'stock') return isWalkIn(item);
  if (filter === 'custom') return isPreorder(item);
  return true;
}

export interface FilterCriteria {
  search: string;
  priceFilter: PriceFilter;
  preorderOnly?: boolean;
  flowerFilter?: string;
  tags?: readonly string[];
  shopFilter: string;
  kioskFilter: string;
  availabilityFilter: AvailabilityFilter;
}

export function filterCatalogItems(items: CatalogItem[], criteria: FilterCriteria): CatalogItem[] {
  const tagsByGroup = new Map<string, string[]>();
  for (const tag of criteria.tags ?? []) {
    const group = getCatalogTagGroup(tag);
    const options = tagsByGroup.get(group) ?? [];
    options.push(tag);
    tagsByGroup.set(group, options);
  }
  return items.filter((item) => {
    if (criteria.preorderOnly && !canOrderOnWeb(item)) return false;
    if (!matchesSearch(item, criteria.search)) return false;
    if (!matchesPrice(item.price, criteria.priceFilter)) return false;
    if (
      criteria.flowerFilter &&
      criteria.flowerFilter !== 'all' &&
      !getFlowerTypeCodes(item.tags).some((code) => code === criteria.flowerFilter)
    )
      return false;
    if (criteria.shopFilter !== 'all' && item.shopName !== criteria.shopFilter) return false;
    if (criteria.kioskFilter !== 'all' && item.kioskName !== criteria.kioskFilter) return false;
    if (!matchesAvailability(item, criteria.availabilityFilter)) return false;
    if (tagsByGroup.size > 0) {
      const tags = getCatalogItemTags(item);
      for (const options of tagsByGroup.values()) {
        if (!options.some((option) => tags.has(option))) return false;
      }
    }
    return true;
  });
}

export function sortCatalogItems(
  items: CatalogItem[],
  sortBy: SortOption,
  distances?: ReadonlyMap<string, number>,
): CatalogItem[] {
  return [...items].sort((a, b) => {
    if (sortBy === 'nearest') {
      const first = distances?.get(a.kioskId);
      const second = distances?.get(b.kioskId);
      const firstDistance =
        first !== undefined && Number.isFinite(first) && first >= 0
          ? first
          : Number.POSITIVE_INFINITY;
      const secondDistance =
        second !== undefined && Number.isFinite(second) && second >= 0
          ? second
          : Number.POSITIVE_INFINITY;
      if (firstDistance !== secondDistance) return firstDistance - secondDistance;
      return a.kioskId.localeCompare(b.kioskId) || a.productId.localeCompare(b.productId);
    }
    if (sortBy === 'price-asc') return a.price - b.price;
    if (sortBy === 'price-desc') return b.price - a.price;
    if (sortBy === 'name-asc') return a.name.localeCompare(b.name, 'vi');
    return 0;
  });
}

export function computeFilterCounts(items: CatalogItem[]) {
  const cards = uniqueCatalogCards(items);
  const flowerCounts: Record<string, number> = {};
  const occasionCounts = new Map<string, { id: string; label: string; count: number }>();
  cards.forEach((item) => {
    for (const code of getFlowerTypeCodes(item.tags)) {
      flowerCounts[code] = (flowerCounts[code] ?? 0) + 1;
    }
    for (const [id, label] of getCatalogItemTags(item)) {
      if (getCatalogTagGroup(id) !== 'occasion' || !readCatalogTags([id]).length) continue;
      const entry = occasionCounts.get(id);
      if (entry) entry.count += 1;
      else occasionCounts.set(id, { id, label, count: 1 });
    }
  });

  const priceCounts = Object.fromEntries(
    PRICE_FILTER_IDS.map((id) => [id, cards.filter((item) => matchesPrice(item.price, id)).length]),
  );
  const preorderAvailableCount = uniqueCatalogCards(items.filter(canOrderOnWeb)).length;
  const occasions = [...occasionCounts.values()].sort(
    (a, b) => b.count - a.count || a.label.localeCompare(b.label, 'vi'),
  );

  let stock = 0;
  let custom = 0;
  cards.forEach((item) => {
    if (matchesAvailability(item, 'stock')) stock++;
    else if (isPreorder(item)) custom++;
  });
  const availabilityCounts: AvailabilityCounts = { stock, custom };

  const shopCounts: Record<string, number> = {};
  cards.forEach((item) => {
    if (item.shopName) shopCounts[item.shopName] = (shopCounts[item.shopName] || 0) + 1;
  });

  const availableShops = Array.from(new Set(items.map((i) => i.shopName))).filter(Boolean);

  return {
    flowerCounts,
    priceCounts,
    preorderAvailableCount,
    occasions,
    availabilityCounts,
    shopCounts,
    availableShops,
  };
}

export function formatPrice(price: number): string {
  return price.toLocaleString('vi-VN');
}
