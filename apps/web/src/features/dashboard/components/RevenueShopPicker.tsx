import { useDeferredValue, useId, useState, type FocusEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@florabot/ui';
import { request } from '@/shared/lib/api';
import styles from './revenue-shop-picker.module.css';

type Shop = { id: string; shopName: string };
export default function RevenueShopPicker({
  actorId,
  value,
  onChange,
}: {
  actorId: string;
  value: Shop | null;
  onChange: (shop: Shop | null) => void;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [active, setActive] = useState(-1);
  const search = useDeferredValue(draft ?? '');
  const shops = useQuery({
    queryKey: ['revenue-sellers', actorId, search, page],
    queryFn: () =>
      request<Shop[]>(`/admin/sellers?${new URLSearchParams({ search, page: String(page) })}`),
    enabled: open,
  });
  const options = [{ id: '', shopName: 'Tất cả shop' }, ...(shops.data ?? [])];
  function choose(shop: Shop) {
    onChange(shop.id ? shop : null);
    setOpen(false);
    setDraft(null);
    setActive(-1);
  }
  function closeOutside(event: FocusEvent<HTMLElement>) {
    if (!event.currentTarget.closest('[data-shop-picker]')?.contains(event.relatedTarget)) {
      setOpen(false);
      setDraft(null);
      setActive(-1);
    }
  }
  return (
    <div className={styles.picker} data-shop-picker="true">
      <label htmlFor={id}>Shop</label>
      <input
        id={id}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={open ? `${id}-options` : undefined}
        aria-activedescendant={
          open && active >= 0 && options[active] ? `${id}-${active}` : undefined
        }
        type="search"
        maxLength={100}
        autoComplete="off"
        placeholder="Tìm hoặc chọn shop…"
        value={draft ?? value?.shopName ?? 'Tất cả shop'}
        onFocus={() => {
          setOpen(true);
          setDraft('');
          setPage(1);
          setActive(-1);
        }}
        onClick={() => {
          if (!open) {
            setOpen(true);
            setDraft('');
            setPage(1);
            setActive(-1);
          }
        }}
        onBlur={closeOutside}
        onChange={(event) => {
          setDraft(event.target.value);
          setPage(1);
          setOpen(true);
          setActive(-1);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            setOpen(false);
            setDraft(null);
            setActive(-1);
          }
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            setOpen(true);
            setActive((index) =>
              event.key === 'ArrowDown'
                ? Math.min(options.length - 1, index + 1)
                : Math.max(0, index - 1),
            );
          }
          if (event.key === 'Enter' && open) {
            event.preventDefault();
            if (active >= 0 && options[active]) choose(options[active]);
          }
        }}
      />
      {open && (
        <div className={styles.popup}>
          <div
            id={`${id}-options`}
            role="listbox"
            aria-label="Chọn shop"
            className={styles.options}
          >
            {options.map((shop, index) => (
              <button
                key={shop.id}
                type="button"
                role="option"
                id={`${id}-${index}`}
                aria-selected={active === index || (active < 0 && shop.id === (value?.id ?? ''))}
                onClick={() => choose(shop)}
                onBlur={closeOutside}
              >
                {shop.shopName}
              </button>
            ))}
          </div>
          {(shops.isFetching || search !== (draft ?? '')) && <p role="status">Đang tìm shop…</p>}
          {shops.isSuccess && !shops.data.length && <p role="status">Không tìm thấy shop.</p>}
          {shops.isError && (
            <div role="alert">
              Chưa tải được shop.{' '}
              <Button
                type="button"
                variant="outline"
                onBlur={closeOutside}
                onClick={() => void shops.refetch()}
              >
                Thử lại
              </Button>
            </div>
          )}
          {(page > 1 || (shops.data?.length ?? 0) >= 25) && (
            <nav aria-label="Trang kết quả shop" className={styles.pages}>
              <Button
                type="button"
                variant="outline"
                disabled={page <= 1 || shops.isFetching}
                onBlur={closeOutside}
                onClick={() => {
                  setPage(page - 1);
                  setActive(-1);
                }}
              >
                Trước
              </Button>
              <span>{page}</span>
              <Button
                type="button"
                variant="outline"
                disabled={shops.isFetching || (shops.data?.length ?? 0) < 25}
                onBlur={closeOutside}
                onClick={() => {
                  setPage(page + 1);
                  setActive(-1);
                }}
              >
                Sau
              </Button>
            </nav>
          )}
        </div>
      )}
    </div>
  );
}
