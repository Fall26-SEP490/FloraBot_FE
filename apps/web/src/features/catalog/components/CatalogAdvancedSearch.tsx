import { ChevronDown, SlidersHorizontal } from '@florabot/ui';
import { useState } from 'react';
import type { getCatalogTagGroups } from '../catalog.tags';

interface CatalogAdvancedSearchProps {
  groups: ReturnType<typeof getCatalogTagGroups>;
  tags: readonly string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSearch: (tags: readonly string[]) => void;
}

export function CatalogAdvancedSearch({
  groups,
  tags,
  open,
  onOpenChange,
  onSearch,
}: CatalogAdvancedSearchProps) {
  const [selected, setSelected] = useState(tags);

  return (
    <details
      className="catalog-advanced-search"
      open={open}
      onToggle={(event) => onOpenChange(event.currentTarget.open)}
    >
      <summary>
        <SlidersHorizontal size={16} aria-hidden="true" />
        Tìm kiếm nâng cao
        <ChevronDown size={16} aria-hidden="true" />
      </summary>
      <form
        className="catalog-advanced-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (selected.length > 0) onSearch(selected);
        }}
      >
        {groups.map(({ group, label, options }) => (
          <fieldset key={group} className="catalog-advanced-group">
            <legend>{label}</legend>
            <div className="catalog-advanced-options">
              {options.map(({ id, label }) => (
                <label key={id} className="catalog-advanced-option">
                  <input
                    type="checkbox"
                    checked={selected.includes(id)}
                    onChange={(event) => {
                      const checked = event.currentTarget.checked;
                      setSelected((current) =>
                        checked ? [...current, id] : current.filter((tag) => tag !== id),
                      );
                    }}
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
        ))}
        <button type="submit" className="button button-primary" disabled={selected.length === 0}>
          Tìm theo tag đã chọn
        </button>
      </form>
    </details>
  );
}
