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
  // Optional FE extension; the current catalog API does not expose slot zones yet.
  // BE must group entries by zone rather than mixing zones in one bouquets array.
  slotZone?: string | null;
  occasion?: string;
  tags?: string[];
  isDemoSample?: boolean;
};

export type CatalogResponse = {
  items: CatalogItem[];
  page: number;
  hasMore: boolean;
};

export type PriceFilter = 'all' | 'under300' | '300to600' | '600to1000' | 'over1000';
export type AvailabilityFilter = 'all' | 'stock' | 'custom';
export type SortOption = 'default' | 'price-asc' | 'price-desc' | 'name-asc';

export interface CatalogFilterState {
  search: string;
  draft: string;
  priceFilter: PriceFilter;
  occasionFilter: string;
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

export interface PriceCounts {
  under300: number;
  range300to600: number;
  range600to1000: number;
  over1000: number;
}

export interface AvailabilityCounts {
  stock: number;
  custom: number;
}
