import { useMemo, useState } from 'react';
import { PRICE_TIER_ACTIVE_LABELS } from '../catalog.constants';
import type {
  ActiveFilterItem,
  AvailabilityFilter,
  CatalogItem,
  PriceFilter,
  SortOption,
} from '../catalog.types';
import { computeFilterCounts, filterCatalogItems, sortCatalogItems } from '../catalog.utils';

export interface CatalogSearchState {
  search: string;
  setSearch: (value: string) => void;
  draft: string;
  setDraft: (value: string) => void;
}

export function useCatalogFilters(rawItems: CatalogItem[], searchState?: CatalogSearchState) {
  const [internalSearch, setInternalSearch] = useState('');
  const [internalDraft, setInternalDraft] = useState('');

  const search = searchState ? searchState.search : internalSearch;
  const setSearch = searchState ? searchState.setSearch : setInternalSearch;
  const draft = searchState ? searchState.draft : internalDraft;
  const setDraft = searchState ? searchState.setDraft : setInternalDraft;

  const [priceFilter, setPriceFilter] = useState<PriceFilter>('all');
  const [occasionFilter, setOccasionFilter] = useState<string>('all');
  const [shopFilter, setShopFilter] = useState<string>('all');
  const [kioskFilter, setKioskFilter] = useState<string>('all');
  const [availabilityFilter, setAvailabilityFilter] = useState<AvailabilityFilter>('all');
  const [sortBy, setSortBy] = useState<SortOption>('default');

  const filteredItems = useMemo(
    () =>
      filterCatalogItems(rawItems, {
        search,
        priceFilter,
        occasionFilter,
        shopFilter,
        kioskFilter,
        availabilityFilter,
      }),
    [rawItems, search, priceFilter, occasionFilter, shopFilter, kioskFilter, availabilityFilter],
  );

  const displayedItems = useMemo(
    () => sortCatalogItems(filteredItems, sortBy),
    [filteredItems, sortBy],
  );

  const counts = useMemo(() => computeFilterCounts(rawItems), [rawItems]);

  const hasActiveFilters = Boolean(
    search.trim() ||
    priceFilter !== 'all' ||
    occasionFilter !== 'all' ||
    shopFilter !== 'all' ||
    kioskFilter !== 'all' ||
    availabilityFilter !== 'all',
  );

  const activeFilters = useMemo(() => {
    const list: ActiveFilterItem[] = [];
    if (search.trim()) {
      list.push({
        id: 'search',
        label: `"${search}"`,
        onClear: () => {
          setSearch('');
          setDraft('');
        },
      });
    }
    if (occasionFilter !== 'all') {
      list.push({
        id: 'occasion',
        label: occasionFilter,
        onClear: () => setOccasionFilter('all'),
      });
    }
    if (priceFilter !== 'all') {
      list.push({
        id: 'price',
        label: PRICE_TIER_ACTIVE_LABELS[priceFilter] || priceFilter,
        onClear: () => setPriceFilter('all'),
      });
    }
    if (availabilityFilter !== 'all') {
      list.push({
        id: 'availability',
        label: availabilityFilter === 'stock' ? 'Có sẵn tại tủ' : 'Đặt trước (Pre-order)',
        onClear: () => setAvailabilityFilter('all'),
      });
    }
    if (shopFilter !== 'all') {
      list.push({
        id: 'shop',
        label: shopFilter,
        onClear: () => setShopFilter('all'),
      });
    }
    if (kioskFilter !== 'all') {
      list.push({
        id: 'kiosk',
        label: kioskFilter,
        onClear: () => setKioskFilter('all'),
      });
    }
    return list;
  }, [
    search,
    occasionFilter,
    priceFilter,
    availabilityFilter,
    shopFilter,
    kioskFilter,
    setSearch,
    setDraft,
  ]);

  const resetFilters = () => {
    setDraft('');
    setSearch('');
    setPriceFilter('all');
    setOccasionFilter('all');
    setShopFilter('all');
    setKioskFilter('all');
    setAvailabilityFilter('all');
    setSortBy('default');
  };

  return {
    search,
    setSearch,
    draft,
    setDraft,
    priceFilter,
    setPriceFilter,
    occasionFilter,
    setOccasionFilter,
    shopFilter,
    setShopFilter,
    kioskFilter,
    setKioskFilter,
    availabilityFilter,
    setAvailabilityFilter,
    sortBy,
    setSortBy,
    filteredItems,
    displayedItems,
    counts,
    hasActiveFilters,
    activeFilters,
    resetFilters,
  };
}

export type CatalogFiltersController = ReturnType<typeof useCatalogFilters>;
