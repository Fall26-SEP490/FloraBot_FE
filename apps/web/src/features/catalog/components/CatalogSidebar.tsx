import Select from '@/shared/components/Select';
import { RotateCcw, SlidersHorizontal, X } from '@florabot/ui';
import { PRICE_TIERS } from '../catalog.constants';
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
    availabilityFilter,
    hasActiveFilters,
    kioskFilter,
    priceFilter,
    resetFilters,
    setAvailabilityFilter,
    setKioskFilter,
    setPriceFilter,
    setShopFilter,
    shopFilter,
    counts: {
      availabilityCounts,
      availableKiosks,
      availableShops,
      kioskCounts,
      flowerCounts,
      priceCounts,
      shopCounts,
    },
  } = filters;

  // Price filter options
  const priceOptions: FilterOption[] = PRICE_TIERS.map((tier) => {
    let count = totalRawItems;
    if (tier.id === 'under300') count = priceCounts.under300;
    else if (tier.id === '300to600') count = priceCounts.range300to600;
    else if (tier.id === '600to1000') count = priceCounts.range600to1000;
    else if (tier.id === 'over1000') count = priceCounts.over1000;

    return {
      id: tier.id,
      label: tier.label,
      count,
      isSelected: priceFilter === tier.id,
      isEmpty: tier.id !== 'all' && count === 0,
      onSelect: () =>
        setPriceFilter(priceFilter === tier.id && tier.id !== 'all' ? 'all' : tier.id),
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

  // Kiosk filter options
  const kioskOptions: FilterOption[] = [
    {
      id: 'all',
      label: 'Tất cả tủ kiosk',
      count: totalRawItems,
      isSelected: kioskFilter === 'all',
      isEmpty: false,
      onSelect: () => setKioskFilter('all'),
    },
    ...availableKiosks.map((kiosk) => {
      const count = kioskCounts[kiosk] || 0;
      return {
        id: kiosk,
        label: kiosk,
        count,
        isSelected: kioskFilter === kiosk,
        isEmpty: count === 0,
        onSelect: () => setKioskFilter(kioskFilter === kiosk ? 'all' : kiosk),
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
        <CatalogFilterGroup title="Hình thức nhận hoa" options={availabilityOptions} />
        <CatalogFilterGroup title="Khoảng giá" options={priceOptions} />
        {(availableKiosks.length > 1 || kioskFilter !== 'all') && (
          <CatalogFilterGroup title="Tủ nhận hoa" options={kioskOptions} />
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
          Xem {filters.displayedItems.length} mẫu hoa
        </button>
      </div>
    </aside>
  );
}
