import type { RefObject } from 'react';
import { SlidersHorizontal } from '@florabot/ui';
import type { SortOption } from '../catalog.types';

interface CatalogToolbarProps {
  filterToggleRef: RefObject<HTMLButtonElement | null>;
  mobileFiltersOpen: boolean;
  onToggleMobileFilters: () => void;
  activeFiltersCount: number;
  onResetFilters: () => void;
  displayedCount: number;
  searchQuery: string;
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
}

export function CatalogToolbar({
  filterToggleRef,
  mobileFiltersOpen,
  onToggleMobileFilters,
  activeFiltersCount,
  onResetFilters,
  displayedCount,
  searchQuery,
  sortBy,
  onSortChange,
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
          {activeFiltersCount > 0 && (
            <span className="catalog-filter-badge">{activeFiltersCount}</span>
          )}
        </button>

        {activeFiltersCount > 0 && (
          <button type="button" className="catalog-mobile-clear-btn" onClick={onResetFilters}>
            Xóa tất cả
          </button>
        )}

        <div className="catalog-results-count" role="status" aria-live="polite">
          <span>
            Hiển thị <strong>{displayedCount}</strong> mẫu hoa phù hợp
            {searchQuery.trim() && (
              <span className="catalog-results-query"> cho &ldquo;{searchQuery.trim()}&rdquo;</span>
            )}
          </span>
        </div>
      </div>

      <div className="catalog-toolbar-right">
        <div className="catalog-sort-wrapper">
          <select
            className="catalog-sort-select"
            aria-label="Sắp xếp sản phẩm"
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value as SortOption)}
          >
            <option value="default">Sắp xếp: Mặc định</option>
            <option value="price-asc">Giá: Thấp đến cao</option>
            <option value="price-desc">Giá: Cao đến thấp</option>
            <option value="name-asc">Tên: A – Z</option>
          </select>
        </div>
      </div>
    </div>
  );
}
