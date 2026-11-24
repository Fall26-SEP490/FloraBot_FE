import { useMemo, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { readCatalogQuery } from '../catalog.navigation';
import { getCatalogTagGroup, readCatalogTags } from '../catalog.tags';
import {
  PREORDER_FILTER_LABEL,
  PRICE_FILTERS,
  RATING_FILTERS,
  type RatingFilter,
} from '../catalog.constants';
import { flowerTags } from '@/shared/lib/flower-tags';
import type {
  ActiveFilterItem,
  AvailabilityFilter,
  CatalogItem,
  PriceFilter,
  SortOption,
} from '../catalog.types';
import {
  computeFilterCounts,
  filterCatalogItems,
  sortCatalogItems,
  uniqueCatalogCards,
} from '../catalog.utils';
import { useCatalogRatings } from './useCatalogRatings';

export function useCatalogFilters(
  rawItems: CatalogItem[],
  distances?: ReadonlyMap<string, number>,
) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const query = searchParams.toString();
  const state = useMemo(() => readCatalogQuery(new URLSearchParams(query)), [query]);
  const {
    search,
    priceFilter,
    preorderOnly,
    productRating,
    shopRating,
    flowerFilter,
    shopFilter,
    kioskFilter,
    availabilityFilter,
    sortBy,
    tags: advancedTags,
  } = state;
  const [draftState, setDraftState] = useState({ search, value: search });
  const draft = draftState.search === search ? draftState.value : search;
  const setDraft = (value: string) => setDraftState({ search, value });
  const update = (key: string, value: string, resetPage = true) => {
    const params = new URLSearchParams(window.location.search);
    params.delete('occasion');
    if (resetPage) params.delete('page');
    if (!value || value === 'all' || value === 'default' || (key === 'page' && value === '1'))
      params.delete(key);
    else params.set(key, value);
    window.history.pushState(null, '', pathname + (params.size ? '?' + params.toString() : ''));
  };
  const setSearch = (value: string) => update('search', value.trim());
  const setPriceFilter = (value: PriceFilter) => update('price', value);
  const setPreorderOnly = (value: boolean) => update('preorder', value ? '1' : '');
  const setProductRating = (value: RatingFilter) => update('productRating', value);
  const setShopRating = (value: RatingFilter) => update('shopRating', value);
  const setFlowerFilter = (value: string) => update('flower', value);
  const setShopFilter = (value: string) => update('shop', value);
  const setKioskFilter = (value: string) => update('kiosk', value);
  const setAvailabilityFilter = (value: AvailabilityFilter) => update('mode', value);
  const setSortBy = (value: SortOption) => update('sort', value);
  const setPage = (value: number) => update('page', String(value), false);
  const applyAdvancedTags = (tags: readonly string[], replaceSearch: boolean) => {
    const params = new URLSearchParams(window.location.search);
    params.delete('tag');
    params.delete('page');
    const selected = readCatalogTags(tags);
    if (replaceSearch) {
      params.delete('search');
      setDraftState({ search: '', value: '' });
      if (selected.some((tag) => getCatalogTagGroup(tag) === 'flower')) params.delete('flower');
    }
    selected.forEach((tag) => params.append('tag', tag));
    window.history.pushState(null, '', pathname + (params.size ? '?' + params.toString() : ''));
  };

  const filteredItems = useMemo(
    () =>
      filterCatalogItems(rawItems, {
        search,
        priceFilter,
        preorderOnly,
        flowerFilter,
        tags: advancedTags,
        shopFilter,
        kioskFilter,
        availabilityFilter,
      }),
    [
      rawItems,
      search,
      priceFilter,
      preorderOnly,
      flowerFilter,
      shopFilter,
      kioskFilter,
      availabilityFilter,
      advancedTags,
    ],
  );

  const {
    filteredItems: ratedItems,
    isLoading: ratingsLoading,
    isError: ratingsError,
    refetch: refetchRatings,
  } = useCatalogRatings(filteredItems, productRating, shopRating);
  const displayedItems = useMemo(
    () => uniqueCatalogCards(sortCatalogItems(ratedItems, sortBy, distances)),
    [ratedItems, sortBy, distances],
  );

  const counts = useMemo(() => computeFilterCounts(rawItems), [rawItems]);
  const totalCards = useMemo(() => uniqueCatalogCards(rawItems).length, [rawItems]);

  const ratingActiveFilters: ActiveFilterItem[] = [];
  if (productRating !== 'all') {
    ratingActiveFilters.push({
      id: 'productRating',
      label: `Sản phẩm · ${RATING_FILTERS[productRating]}`,
      onClear: () => setProductRating('all'),
    });
  }
  if (shopRating !== 'all') {
    ratingActiveFilters.push({
      id: 'shopRating',
      label: `Shop · ${RATING_FILTERS[shopRating]}`,
      onClear: () => setShopRating('all'),
    });
  }
  const hasActiveFilters = Boolean(
    search.trim() ||
    advancedTags.length > 0 ||
    priceFilter !== 'all' ||
    preorderOnly ||
    ratingActiveFilters.length > 0 ||
    flowerFilter !== 'all' ||
    shopFilter !== 'all' ||
    kioskFilter !== 'all' ||
    availabilityFilter !== 'all',
  );

  const activeFilters = (() => {
    const list = [...ratingActiveFilters];
    if (flowerFilter !== 'all') {
      list.push({
        id: 'flower',
        label: flowerTags[flowerFilter as keyof typeof flowerTags],
        onClear: () => setFlowerFilter('all'),
      });
    }
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
    if (priceFilter !== 'all') {
      list.push({
        id: 'price',
        label: PRICE_FILTERS[priceFilter].label,
        onClear: () => setPriceFilter('all'),
      });
    }
    if (preorderOnly) {
      list.push({
        id: 'preorder',
        label: PREORDER_FILTER_LABEL,
        onClear: () => setPreorderOnly(false),
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
    for (const key of [
      'search',
      'price',
      'preorder',
      'productRating',
      'shopRating',
      'occasion',
      'flower',
      'tag',
      'shop',
      'kiosk',
      'mode',
      'sort',
      'page',
    ])
      params.delete(key);
    window.history.pushState(null, '', pathname + (params.size ? '?' + params.toString() : ''));
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
    preorderOnly,
    setPreorderOnly,
    productRating,
    setProductRating,
    shopRating,
    setShopRating,
    ratingActiveFilters,
    ratingsLoading,
    ratingsError,
    refetchRatings,
    flowerFilter,
    setFlowerFilter,
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
    totalCards,
    hasActiveFilters,
    activeFilters,
    resetFilters,
    advancedTags,
    applyAdvancedTags,
  };
}

export type CatalogFiltersController = ReturnType<typeof useCatalogFilters>;
