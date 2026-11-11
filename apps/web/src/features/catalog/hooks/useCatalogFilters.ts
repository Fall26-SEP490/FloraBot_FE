import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { readCatalogQuery } from '../catalog.navigation';
import { PRICE_TIER_ACTIVE_LABELS } from '../catalog.constants';
import type {
  ActiveFilterItem,
  AvailabilityFilter,
  CatalogItem,
  PriceFilter,
  SortOption,
} from '../catalog.types';
import { computeFilterCounts, filterCatalogItems, sortCatalogItems } from '../catalog.utils';

export function useCatalogFilters(
  rawItems: CatalogItem[],
  distances?: ReadonlyMap<string, number>,
) {
  const searchParams = useSearchParams();
  const state = readCatalogQuery(new URLSearchParams(searchParams.toString()));
  const {
    search,
    priceFilter,
    occasionFilter,
    shopFilter,
    kioskFilter,
    availabilityFilter,
    sortBy,
  } = state;
  const [draftState, setDraftState] = useState({ search, value: search });
  const draft = draftState.search === search ? draftState.value : search;
  const setDraft = (value: string) => setDraftState({ search, value });
  const update = (key: string, value: string, resetPage = true) => {
    const params = new URLSearchParams(window.location.search);
    if (resetPage) params.delete('page');
    if (!value || value === 'all' || value === 'default' || (key === 'page' && value === '1'))
      params.delete(key);
    else params.set(key, value);
    window.history.pushState(null, '', '/dat-hoa' + (params.size ? '?' + params.toString() : ''));
  };
  const setSearch = (value: string) => update('search', value.trim());
  const setPriceFilter = (value: PriceFilter) => update('price', value);
  const setOccasionFilter = (value: string) => update('occasion', value);
  const setShopFilter = (value: string) => update('shop', value);
  const setKioskFilter = (value: string) => update('kiosk', value);
  const setAvailabilityFilter = (value: AvailabilityFilter) => update('mode', value);
  const setSortBy = (value: SortOption) => update('sort', value);
  const setPage = (value: number) => update('page', String(value), false);

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
    () => sortCatalogItems(filteredItems, sortBy, distances),
    [filteredItems, sortBy, distances],
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

  const activeFilters = (() => {
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
        label: availabilityFilter === 'stock' ? 'Mua trực tiếp tại tủ' : 'Đặt theo yêu cầu',
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
  })();

  const resetFilters = () => {
    setDraftState({ search: '', value: '' });
    const params = new URLSearchParams(window.location.search);
    for (const key of ['search', 'price', 'occasion', 'shop', 'kiosk', 'mode', 'sort', 'page'])
      params.delete(key);
    window.history.pushState(null, '', '/dat-hoa' + (params.size ? '?' + params.toString() : ''));
  };

  return {
    page: state.page,
    setPage,
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
