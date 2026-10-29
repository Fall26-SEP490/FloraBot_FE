import { RotateCcw, SlidersHorizontal, X } from '@florabot/ui';
import { OCCASIONS, PRICE_TIERS } from '../catalog.constants';
import type { CatalogFiltersController } from '../hooks/useCatalogFilters';
import { CatalogFilterGroup, type FilterOption } from './CatalogFilterGroup';

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
    occasionFilter,
    priceFilter,
    resetFilters,
    setAvailabilityFilter,
    setKioskFilter,
    setOccasionFilter,
    setPriceFilter,
    setShopFilter,
    shopFilter,
    counts: {
      availabilityCounts,
      availableKiosks,
      availableShops,
      kioskCounts,
      occasionCounts,
      priceCounts,
      shopCounts,
    },
  } = filters;

  // Occasion filter options
  const occasionOptions: FilterOption[] = [
    {
      id: 'all',
      label: 'Tất cả dịp',
      count: totalRawItems,
      isSelected: occasionFilter === 'all',
      isEmpty: false,
      onSelect: () => setOccasionFilter('all'),
    },
    ...OCCASIONS.map((occ) => {
      const count = occasionCounts[occ] || 0;
      return {
        id: occ,
        label: occ,
        count,
        isSelected: occasionFilter === occ,
        isEmpty: count === 0,
        onSelect: () => setOccasionFilter(occasionFilter === occ ? 'all' : occ),
      };
    }).filter((opt) => opt.count > 0 || totalRawItems > 0),
  ];

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
      label: 'Tất cả tình trạng',
      count: totalRawItems,
      isSelected: availabilityFilter === 'all',
      isEmpty: false,
      onSelect: () => setAvailabilityFilter('all'),
    },
    {
      id: 'stock',
      label: 'Có sẵn tại tủ kiosk',
      count: availabilityCounts.stock,
      isSelected: availabilityFilter === 'stock',
      isEmpty: availabilityCounts.stock === 0,
      onSelect: () => setAvailabilityFilter(availabilityFilter === 'stock' ? 'all' : 'stock'),
    },
    {
      id: 'custom',
      label: 'Đặt trước',
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
              title="Đặt lại bộ lọc"
              aria-label="Đặt lại bộ lọc"
            >
              <X size={15} aria-hidden="true" />
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
        <CatalogFilterGroup title="Dịp tặng" options={occasionOptions} />
        <CatalogFilterGroup title="Khoảng giá" options={priceOptions} />
        <CatalogFilterGroup title="Hình thức nhận hoa" options={availabilityOptions} />
        {availableShops.length > 1 && <CatalogFilterGroup title="Cửa hàng" options={shopOptions} />}
        {availableKiosks.length > 1 && (
          <CatalogFilterGroup title="Điểm tủ Kiosk" options={kioskOptions} />
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
          Áp dụng
        </button>
      </div>
    </aside>
  );
}
