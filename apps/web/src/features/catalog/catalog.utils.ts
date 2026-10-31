import { OCCASIONS, OCCASION_BADGE_CLASSES } from './catalog.constants';
import type {
  AvailabilityCounts,
  AvailabilityFilter,
  CatalogItem,
  PriceCounts,
  PriceFilter,
  SortOption,
} from './catalog.types';

export function isWalkIn(item: CatalogItem): boolean {
  return item.zone === 'WALK_IN';
}

export function canOrderOnWeb(item: CatalogItem): boolean {
  // /shop/catalog reads v_web_catalog: its bouquet IDs already exclude WALK_IN.
  // An explicit zone takes precedence if the API includes kiosk-only entries.
  return item.zone == null || item.zone === 'PREORDER';
}

export function purchaseLabel(item: CatalogItem): string {
  if (isWalkIn(item)) return 'Chỉ mua tại kiosk';
  return canOrderOnWeb(item) ? 'Đặt trước' : 'Chưa xác định hình thức mua';
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
  const hasStock = isWalkIn(item) || item.bouquets.length > 0;
  if (filter === 'stock') return hasStock;
  if (filter === 'custom') return !hasStock;
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

export function sortCatalogItems(items: CatalogItem[], sortBy: SortOption): CatalogItem[] {
  return [...items].sort((a, b) => {
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
  const occasionCounts: Record<string, number> = {};
  OCCASIONS.forEach((occ) => {
    occasionCounts[occ] = items.filter((item) => matchesOccasion(item, occ)).length;
  });

  let under300 = 0;
  let range300to600 = 0;
  let range600to1000 = 0;
  let over1000 = 0;
  items.forEach((item) => {
    if (item.price < 300000) under300++;
    else if (item.price <= 600000) range300to600++;
    else if (item.price <= 1000000) range600to1000++;
    else over1000++;
  });
  const priceCounts: PriceCounts = { under300, range300to600, range600to1000, over1000 };

  let stock = 0;
  let custom = 0;
  items.forEach((item) => {
    if (matchesAvailability(item, 'stock')) stock++;
    else custom++;
  });
  const availabilityCounts: AvailabilityCounts = { stock, custom };

  const shopCounts: Record<string, number> = {};
  items.forEach((item) => {
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
