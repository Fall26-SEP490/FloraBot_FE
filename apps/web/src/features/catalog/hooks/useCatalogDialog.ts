import { useEffect, useRef, useState } from 'react';
import type { CatalogItem } from '../catalog.types';

export function useCatalogDialog() {
  const [selected, setSelected] = useState<CatalogItem | null>(null);
  const [detailModalItem, setDetailModalItem] = useState<CatalogItem | null>(null);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const filterToggleRef = useRef<HTMLButtonElement | null>(null);
  const modalTriggerRef = useRef<HTMLElement | null>(null);
  const modalCloseBtnRef = useRef<HTMLButtonElement | null>(null);
  const modalContentRef = useRef<HTMLDivElement | null>(null);

  const closeMobileFilters = () => {
    setMobileFiltersOpen(false);
    filterToggleRef.current?.focus();
  };

  const openDetailModal = (item: CatalogItem, triggerEl: HTMLElement) => {
    modalTriggerRef.current = triggerEl;
    setDetailModalItem(item);
  };

  const closeDetailModal = () => {
    setDetailModalItem(null);
    modalTriggerRef.current?.focus();
  };

  // Mobile filters Escape listener
  useEffect(() => {
    if (!mobileFiltersOpen || detailModalItem) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileFiltersOpen(false);
        filterToggleRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [mobileFiltersOpen, detailModalItem]);

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

  // Detail modal scroll lock, focus trap, and Escape listener
  useEffect(() => {
    if (!detailModalItem) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    modalCloseBtnRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeDetailModal();
        return;
      }
      if (e.key === 'Tab' && modalContentRef.current) {
        const focusable = modalContentRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [detailModalItem]);

  return {
    selected,
    setSelected,
    detailModalItem,
    openDetailModal,
    closeDetailModal,
    mobileFiltersOpen,
    setMobileFiltersOpen,
    closeMobileFilters,
    filterToggleRef,
    modalCloseBtnRef,
    modalContentRef,
  };
}
