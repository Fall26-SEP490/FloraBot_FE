import { useEffect, useRef, useState } from 'react';
import type { CatalogItem } from '../catalog.types';

export function useCatalogDialog() {
  const [selected, setSelected] = useState<CatalogItem | null>(null);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const filterToggleRef = useRef<HTMLButtonElement | null>(null);

  const closeMobileFilters = () => {
    setMobileFiltersOpen(false);
    filterToggleRef.current?.focus();
  };

  // Mobile filters Escape listener
  useEffect(() => {
    if (!mobileFiltersOpen) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileFiltersOpen(false);
        filterToggleRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [mobileFiltersOpen]);

  // Mobile filters scroll lock
  useEffect(() => {
    if (mobileFiltersOpen) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [mobileFiltersOpen]);

  return {
    selected,
    setSelected,
    mobileFiltersOpen,
    setMobileFiltersOpen,
    closeMobileFilters,
    filterToggleRef,
  };
}
