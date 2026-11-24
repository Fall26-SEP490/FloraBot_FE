import Select from '@/shared/components/Select';
import { RotateCcw, SlidersHorizontal, X } from '@florabot/ui';
import {
  DEFAULT_PRICE_FILTERS,
  PREORDER_FILTER_LABEL,
  PRICE_FILTERS,
  RATING_FILTERS,
  RATING_FILTER_IDS,
  type RatingFilter,
} from '../catalog.constants';
import type { CatalogFiltersController } from '../hooks/useCatalogFilters';
import { CatalogFilterGroup, type FilterOption } from './CatalogFilterGroup';
import { flowerTags } from '@/shared/lib/flower-tags';

interface CatalogSidebarProps {
  filters: CatalogFiltersController;
  mobileFiltersOpen: boolean;
  onClose: () => void;
  totalRawItems: number;
}

export function CatalogSidebar({
  filters,
  mobileFiltersOpen,
  onClose,
  totalRawItems,
}: CatalogSidebarProps) {
  const {
    advancedTags,
    applyAdvancedTags,
    availabilityFilter,
    hasActiveFilters,
    priceFilter,
    preorderOnly,
    resetFilters,
    setAvailabilityFilter,
    setPriceFilter,
    setPreorderOnly,
    setShopFilter,
    shopFilter,
    counts: {
      availabilityCounts,
      availableShops,
      flowerCounts,
      occasions,
      preorderAvailableCount,
      priceCounts,
      shopCounts,
    },
  } = filters;

  const visiblePriceFilters = DEFAULT_PRICE_FILTERS.includes(priceFilter)
    ? DEFAULT_PRICE_FILTERS
    : [...DEFAULT_PRICE_FILTERS, priceFilter];
  const priceOptions: FilterOption[] = visiblePriceFilters.map((id) => {
    const count = priceCounts[id];
    return {
      id,
      label: PRICE_FILTERS[id].label,
      count,
      isSelected: priceFilter === id,
      isEmpty: id !== 'all' && count === 0,
      onSelect: () => setPriceFilter(id),
    };
  });

  const occasionOptions: FilterOption[] = occasions.slice(0, 3).map((option) => {
    const isSelected = advancedTags.includes(option.id);
    return {
      ...option,
      isSelected,
      isEmpty: false,
      onSelect: () =>
        applyAdvancedTags(
          isSelected
            ? advancedTags.filter((tag) => tag !== option.id)
            : [...advancedTags, option.id],
          false,
        ),
    };
  });

  // Availability filter options
  const availabilityOptions: FilterOption[] = [
    {
      id: 'all',
      label: 'Tất cả hình thức',
      count: totalRawItems,
      isSelected: availabilityFilter === 'all',
      isEmpty: false,
      onSelect: () => setAvailabilityFilter('all'),
    },
    {
      id: 'stock',
      label: 'Mua trực tiếp tại tủ',
      count: availabilityCounts.stock,
      isSelected: availabilityFilter === 'stock',
      isEmpty: availabilityCounts.stock === 0,
      onSelect: () => setAvailabilityFilter(availabilityFilter === 'stock' ? 'all' : 'stock'),
    },
    {
      id: 'custom',
      label: 'Đặt trước qua web',
      count: availabilityCounts.custom,
      isSelected: availabilityFilter === 'custom',
      isEmpty: availabilityCounts.custom === 0,
      onSelect: () => setAvailabilityFilter(availabilityFilter === 'custom' ? 'all' : 'custom'),
    },
  ];
  const showAvailabilityFilter = availabilityOptions.some(
    ({ id, count, isSelected }) =>
      id !== 'all' && count < totalRawItems && (count > 0 || isSelected),
  );

  // Shop filter options
  const shopOptions: FilterOption[] = [
    {
      id: 'all',
      label: 'Tất cả cửa hàng',
      count: totalRawItems,
      isSelected: shopFilter === 'all',
      isEmpty: false,
      onSelect: () => setShopFilter('all'),
    },
    ...availableShops.map((shop) => {
      const count = shopCounts[shop] || 0;
      return {
        id: shop,
        label: shop,
        count,
        isSelected: shopFilter === shop,
        isEmpty: count === 0,
        onSelect: () => setShopFilter(shopFilter === shop ? 'all' : shop),
      };
    }),
  ];

  return (
    <aside
      id="catalog-filters"
      className={`catalog-sidebar ${mobileFiltersOpen ? 'is-mobile-open' : ''}`}
      aria-label="Bộ lọc sản phẩm"
    >
      <div className="catalog-sheet-drag-handle" aria-hidden="true" />
      <div className="catalog-sidebar-header">
        <h2 className="catalog-sidebar-title">
          <SlidersHorizontal size={18} aria-hidden="true" />
          <span>Bộ lọc</span>
        </h2>
        <div className="catalog-sidebar-header-actions">
          {hasActiveFilters && (
            <button
              type="button"
              className="catalog-sidebar-reset-btn"
              onClick={resetFilters}
              aria-label="Đặt lại bộ lọc"
            >
              Đặt lại
            </button>
          )}
          <button
            type="button"
            className="catalog-sheet-close-btn"
            onClick={onClose}
            title="Đóng bộ lọc"
            aria-label="Đóng bộ lọc"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="catalog-sidebar-scroll-body">
        {(availabilityCounts.custom > 0 || preorderOnly) && (
          <label className="catalog-filter-option catalog-preorder-filter">
            <input
              type="checkbox"
              checked={preorderOnly}
              onChange={(event) => setPreorderOnly(event.target.checked)}
            />
            <span className="catalog-option-text">{PREORDER_FILTER_LABEL}</span>
            <span className="catalog-option-count" aria-hidden="true">
              {preorderAvailableCount}
            </span>
          </label>
        )}
        <label className="catalog-filter-field">
          Loại hoa
          <Select
            value={filters.flowerFilter}
            onChange={(event) => filters.setFlowerFilter(event.target.value)}
          >
            <option value="all">Tất cả loại hoa</option>
            {filters.flowerFilter !== 'all' && !flowerCounts[filters.flowerFilter] && (
              <option value={filters.flowerFilter} hidden>
                {flowerTags[filters.flowerFilter as keyof typeof flowerTags]}
              </option>
            )}
            {Object.entries(flowerTags)
              .filter(([code]) => (flowerCounts[code] ?? 0) > 0)
              .map(([code, label]) => (
                <option
                  key={code}
                  value={code}
                  disabled={!flowerCounts[code] && filters.flowerFilter !== code}
                >
                  {label}: còn {flowerCounts[code] ?? 0} mẫu
                </option>
              ))}
          </Select>
        </label>
        {showAvailabilityFilter && (
          <CatalogFilterGroup title="Hình thức nhận hoa" options={availabilityOptions} />
        )}
        <CatalogFilterGroup title="Khoảng giá" options={priceOptions} />
        {(
          [
            ['Đánh giá sản phẩm', filters.productRating, filters.setProductRating],
            ['Đánh giá shop', filters.shopRating, filters.setShopRating],
          ] as const
        ).map(([label, value, select]) => (
          <label key={label} className="catalog-filter-field">
            {label}
            <Select value={value} onChange={(event) => select(event.target.value as RatingFilter)}>
              {RATING_FILTER_IDS.map((id) => (
                <option key={id} value={id}>
                  {RATING_FILTERS[id]}
                </option>
              ))}
            </Select>
          </label>
        ))}
        {occasionOptions.length > 0 && (
          <CatalogFilterGroup title="Dịp tặng" options={occasionOptions} multiple />
        )}
        {(availableShops.length > 1 || shopFilter !== 'all') && (
          <details className="catalog-more-filters" open={shopFilter !== 'all' || undefined}>
            <summary>Cửa hàng</summary>
            <CatalogFilterGroup title="Cửa hàng" options={shopOptions} />
          </details>
        )}
      </div>

      <div className="catalog-sheet-footer">
        {hasActiveFilters && (
          <button type="button" className="catalog-sheet-reset-btn" onClick={resetFilters}>
            <RotateCcw size={14} aria-hidden="true" />
            <span>Đặt lại</span>
          </button>
        )}
        <button
          type="button"
          className="catalog-mobile-apply-btn"
          onClick={onClose}
          aria-label="Áp dụng bộ lọc"
        >
          {filters.ratingsLoading || filters.ratingsError
            ? 'Xem kết quả'
            : `Xem ${filters.displayedItems.length} mẫu hoa`}
        </button>
      </div>
    </aside>
  );
}
