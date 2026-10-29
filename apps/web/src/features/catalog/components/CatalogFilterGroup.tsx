import { Check } from '@florabot/ui';

export interface FilterOption {
  id: string;
  label: string;
  count: number;
  isSelected: boolean;
  isEmpty: boolean;
  onSelect: () => void;
}

interface CatalogFilterGroupProps {
  title: string;
  options: FilterOption[];
}

export function CatalogFilterGroup({ title, options }: CatalogFilterGroupProps) {
  return (
    <div className="catalog-filter-group">
      <h3 className="catalog-filter-title">{title}</h3>
      <ul className="catalog-filter-list">
        {options.map((option) => (
          <li key={option.id}>
            <button
              type="button"
              className={`catalog-filter-option ${option.isSelected ? 'is-active' : ''} ${
                option.isEmpty ? 'is-empty' : ''
              }`}
              aria-pressed={option.isSelected}
              onClick={option.onSelect}
            >
              <span className="catalog-option-checkbox">
                {option.isSelected && <Check size={12} strokeWidth={3} />}
              </span>
              <span className="catalog-option-text">{option.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
