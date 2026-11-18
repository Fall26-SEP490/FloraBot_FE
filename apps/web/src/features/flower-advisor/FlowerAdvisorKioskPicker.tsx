import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, MapPin, Search } from '@florabot/ui';
import type { CustomerKioskLocationItem } from '../kiosk-location/kiosk-location.types';

const fold = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/đ/g, 'd');

export function FlowerAdvisorKioskPicker({
  items,
  selectedId,
  loading,
  failed,
  onRetry,
  onSelect,
  onBack,
}: {
  items: CustomerKioskLocationItem[];
  selectedId: string;
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
  onSelect: (id: string) => void;
  onBack: () => void;
}) {
  const search = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const tokens = fold(query).trim().split(/\s+/).filter(Boolean);
  const matches = items.filter((item) =>
    tokens.every((token) =>
      fold([item.name, item.code, item.address, item.region].filter(Boolean).join(' ')).includes(
        token,
      ),
    ),
  );

  useEffect(() => {
    search.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      onBack();
    };
    document.addEventListener('keydown', escape, true);
    return () => document.removeEventListener('keydown', escape, true);
  }, [onBack]);

  return (
    <section className="flower-advisor-picker" aria-label="Chọn kiosk mua tại tủ">
      <div className="flower-advisor-picker-heading">
        <button type="button" onClick={onBack} aria-label="Quay lại hội thoại">
          <ArrowLeft size={18} aria-hidden="true" />
        </button>
        <h3>Chọn kiosk mua tại tủ</h3>
      </div>
      <div className="flower-advisor-picker-search">
        <Search size={16} aria-hidden="true" />
        <input
          ref={search}
          type="search"
          aria-label="Tìm kiosk"
          placeholder="Tìm tên, mã hoặc địa chỉ…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <div className="flower-advisor-picker-results">
        {loading ? (
          <p role="status">Đang tải kiosk…</p>
        ) : failed ? (
          <div className="flower-advisor-picker-empty" role="status">
            <p>Chưa tải được danh sách kiosk.</p>
            <button type="button" className="flower-advisor-retry" onClick={onRetry}>
              Tải lại kiosk
            </button>
          </div>
        ) : (
          <>
            {selectedId && !query && (
              <button
                type="button"
                className="flower-advisor-text-button"
                onClick={() => onSelect('')}
              >
                Bỏ chọn kiosk
              </button>
            )}
            {matches.length ? (
              <ul aria-label="Danh sách kiosk">
                {matches.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className="flower-advisor-picker-row"
                      aria-pressed={item.id === selectedId}
                      onClick={() => onSelect(item.id)}
                    >
                      <MapPin size={18} aria-hidden="true" />
                      <span>
                        <strong>{item.name}</strong>
                        {item.address && <span>{item.address}</span>}
                      </span>
                      {item.id === selectedId && <Check size={18} aria-hidden="true" />}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p role="status">
                {items.length ? 'Không tìm thấy kiosk phù hợp.' : 'Chưa có kiosk để chọn.'}
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}
