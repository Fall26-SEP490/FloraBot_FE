import { OCCASIONS, OCCASION_BADGE_CLASSES } from './catalog.constants';
import type {
  AvailabilityCounts,
  AvailabilityFilter,
  CatalogItem,
  PriceCounts,
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

export function matchesOccasion(item: CatalogItem, occasion: string): boolean {
  return Boolean(
    item.occasion === occasion ||
    item.tags?.includes(occasion) ||
    item.description?.toLowerCase().includes(occasion.toLowerCase()),
  );
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
  if (filter === 'under300') return price < 300000;
  if (filter === '300to600') return price >= 300000 && price <= 600000;
  if (filter === '600to1000') return price > 600000 && price <= 1000000;
  if (filter === 'over1000') return price > 1000000;
  return true;
}

export function matchesAvailability(item: CatalogItem, filter: AvailabilityFilter): boolean {
  if (filter === 'stock') return isWalkIn(item);
  if (filter === 'custom') return isPreorder(item);
  return true;
}

export interface FilterCriteria {
  search: string;
  priceFilter: PriceFilter;
  occasionFilter: string;
  shopFilter: string;
  kioskFilter: string;
  availabilityFilter: AvailabilityFilter;
}

export function filterCatalogItems(items: CatalogItem[], criteria: FilterCriteria): CatalogItem[] {
  return items.filter((item) => {
    if (!matchesSearch(item, criteria.search)) return false;
    if (!matchesPrice(item.price, criteria.priceFilter)) return false;
    if (criteria.occasionFilter !== 'all' && !matchesOccasion(item, criteria.occasionFilter)) {
      return false;
    }
    if (criteria.shopFilter !== 'all' && item.shopName !== criteria.shopFilter) return false;
    if (criteria.kioskFilter !== 'all' && item.kioskName !== criteria.kioskFilter) return false;
    if (!matchesAvailability(item, criteria.availabilityFilter)) return false;
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

export function getOccasionBadgeClass(occasion?: string): string {
  if (!occasion) return '';
  return OCCASION_BADGE_CLASSES[occasion] || '';
}

export function computeFilterCounts(items: CatalogItem[]) {
  const cards = uniqueCatalogCards(items);
  const occasionCounts: Record<string, number> = {};
  OCCASIONS.forEach((occ) => {
    occasionCounts[occ] = cards.filter((item) => matchesOccasion(item, occ)).length;
  });

  let under300 = 0;
  let range300to600 = 0;
  let range600to1000 = 0;
  let over1000 = 0;
  cards.forEach((item) => {
    if (item.price < 300000) under300++;
    else if (item.price <= 600000) range300to600++;
    else if (item.price <= 1000000) range600to1000++;
    else over1000++;
  });
  const priceCounts: PriceCounts = { under300, range300to600, range600to1000, over1000 };

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

  const kioskCounts: Record<string, number> = {};
  items.forEach((item) => {
    if (item.kioskName) kioskCounts[item.kioskName] = (kioskCounts[item.kioskName] || 0) + 1;
  });

  const availableShops = Array.from(new Set(items.map((i) => i.shopName))).filter(Boolean);
  const availableKiosks = Array.from(new Set(items.map((i) => i.kioskName))).filter(Boolean);

  return {
    occasionCounts,
    priceCounts,
    availabilityCounts,
    shopCounts,
    kioskCounts,
    availableShops,
    availableKiosks,
  };
}

export function formatPrice(price: number): string {
  return price.toLocaleString('vi-VN');
}
