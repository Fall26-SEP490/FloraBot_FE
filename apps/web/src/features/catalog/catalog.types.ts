import type { PRICE_FILTERS } from './catalog.constants';

export type CatalogItem = {
  productId: string;
  sellerId: string;
  shopName: string;
  name: string;
  description: string | null;
  price: number;
  kioskId: string;
  kioskName: string;
  address: string;
  photo: string | null;
  bouquets: string[];
  // Older catalog responses may omit zone; current responses identify the sales channel.
  zone?: string | null;
  preorderAvailable?: boolean;
  occasion?: string;
  tags?: string[];
  isDemoSample?: boolean;
};

export type CatalogResponse = {
  items: CatalogItem[];
  page: number;
  hasMore: boolean;
};

export type PriceFilter = keyof typeof PRICE_FILTERS;
export type AvailabilityFilter = 'all' | 'stock' | 'custom';
export type SortOption = 'default' | 'price-asc' | 'price-desc' | 'name-asc' | 'nearest';

export interface CatalogFilterState {
  search: string;
  draft: string;
  priceFilter: PriceFilter;
  shopFilter: string;
  kioskFilter: string;
  availabilityFilter: AvailabilityFilter;
  sortBy: SortOption;
}

export interface ActiveFilterItem {
  id: string;
  label: string;
  onClear: () => void;
}

export interface AvailabilityCounts {
  stock: number;
  custom: number;
}
