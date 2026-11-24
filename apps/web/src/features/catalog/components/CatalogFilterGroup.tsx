import { useId } from 'react';

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
  multiple?: boolean;
}

export function CatalogFilterGroup({ title, options, multiple = false }: CatalogFilterGroupProps) {
  const groupId = useId();
  return (
    <fieldset className="catalog-filter-group">
      <legend className="catalog-filter-title">{title}</legend>
      <ul className="catalog-filter-list">
        {options
          .filter((option) => option.id === 'all' || option.count > 0 || option.isSelected)
          .map((option) => (
            <li key={option.id}>
              <label
                className={`catalog-filter-option ${option.isSelected ? 'is-active' : ''} ${
                  option.isEmpty ? 'is-empty' : ''
                }`}
              >
                <input
                  type={multiple ? 'checkbox' : 'radio'}
                  name={groupId}
                  value={option.id}
                  checked={option.isSelected}
                  disabled={option.isEmpty && !option.isSelected}
                  onChange={option.onSelect}
                />
                <span className="catalog-option-text">{option.label}</span>
                <span className="catalog-option-count">
                  {option.count > 0 ? option.count : null}
                </span>
              </label>
            </li>
          ))}
      </ul>
    </fieldset>
  );
}
