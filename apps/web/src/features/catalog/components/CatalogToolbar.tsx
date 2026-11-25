import Select from '@/shared/components/Select';
import type { RefObject } from 'react';
import { ChevronDown, MapPin, SlidersHorizontal } from '@florabot/ui';
import type { SortOption } from '../catalog.types';

interface CatalogToolbarProps {
  filterToggleRef: RefObject<HTMLButtonElement | null>;
  mobileFiltersOpen: boolean;
  onToggleMobileFilters: () => void;
  activeFiltersCount: number;
  displayedCount: number;
  searchQuery: string;
  ratingStatus?: string;
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
  locating?: boolean;
  onLocate?: () => void;
  advancedSearchOpen: boolean;
  onToggleAdvancedSearch: () => void;
}

export function CatalogToolbar({
  filterToggleRef,
  mobileFiltersOpen,
  onToggleMobileFilters,
  activeFiltersCount,
  displayedCount,
  searchQuery,
  ratingStatus,
  sortBy,
  onSortChange,
  locating,
  onLocate,
  advancedSearchOpen,
  onToggleAdvancedSearch,
}: CatalogToolbarProps) {
  return (
    <div className="catalog-content-toolbar">
      <div className="catalog-toolbar-left">
        <button
          ref={filterToggleRef}
          type="button"
          className={`catalog-mobile-filter-btn ${activeFiltersCount > 0 ? 'is-filtered' : ''}`}
          onClick={onToggleMobileFilters}
          aria-expanded={mobileFiltersOpen}
          aria-controls="catalog-filters"
        >
          <SlidersHorizontal size={15} aria-hidden="true" />
          <span>Bộ lọc</span>
        </button>

        <div className="catalog-results-count" role="status" aria-live="polite">
          {ratingStatus || (
            <span>
              Hiển thị <strong>{displayedCount}</strong> mẫu hoa phù hợp
              {searchQuery.trim() && (
                <span className="catalog-results-query">
                  {' '}
                  cho &ldquo;{searchQuery.trim()}&rdquo;
                </span>
              )}
            </span>
          )}
        </div>
      </div>

      <div className="catalog-toolbar-right">
        <button
          type="button"
          className="catalog-advanced-toggle catalog-locate-btn"
          aria-expanded={advancedSearchOpen}
          aria-controls="catalog-advanced-search"
          onClick={onToggleAdvancedSearch}
        >
          <SlidersHorizontal size={16} aria-hidden="true" />
          <span>Tìm kiếm nâng cao</span>
          <ChevronDown size={16} aria-hidden="true" />
        </button>
        <div className="catalog-sort-wrapper">
          <Select
            className="catalog-sort-select"
            popupMinWidth={240}
            aria-label="Sắp xếp sản phẩm"
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value as SortOption)}
          >
            <option value="default">Mặc định</option>
            <option value="nearest">Khoảng cách: Gần nhất</option>
            <option value="price-asc">Giá: Thấp đến cao</option>
            <option value="price-desc">Giá: Cao đến thấp</option>
            <option value="name-asc">Tên: A – Z</option>
          </Select>
        </div>

        {onLocate && (
          <button
            type="button"
            className={`catalog-locate-btn ${sortBy === 'nearest' ? 'is-active' : ''}`}
            disabled={locating}
            onClick={onLocate}
            aria-label={locating ? 'Đang lấy vị trí' : 'Xếp hoa gần tôi'}
            title="Xếp hoa gần tôi"
            aria-pressed={sortBy === 'nearest'}
          >
            <MapPin size={15} aria-hidden="true" />
            <span>{locating ? 'Đang lấy vị trí…' : 'Xếp hoa gần tôi'}</span>
          </button>
        )}
      </div>
    </div>
  );
}
