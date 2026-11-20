import { describe, expect, it } from 'vitest';
import {
  stockKioskOptions,
  selectedStockKiosk,
} from '../apps/web/src/features/inventory/seller-stock-kiosks';

describe('seller stock kiosk selection', () => {
  it('keeps offline and maintenance inventory visible when no kiosk is online', () => {
    const options = stockKioskOptions([
      { id: 'new', status: 'OFFLINE' },
      { id: 'old', status: 'MAINTENANCE' },
    ]);
    expect(options.map((k) => k.id)).toEqual(['new', 'old']);
    expect(selectedStockKiosk(options, '')?.id).toBe('new');
  });
  it('defaults to the newest kiosk even when an older kiosk is online', () => {
    const rows = [
      { id: 'offline', status: 'OFFLINE' },
      { id: 'new-online', status: 'ONLINE' },
      { id: 'old-online', status: 'ONLINE' },
    ];
    expect(selectedStockKiosk(stockKioskOptions(rows), '')?.id).toBe('offline');
    expect(rows[0].id).toBe('offline');
  });
  it('preserves an explicit selection even after its connection drops', () => {
    const options = stockKioskOptions([
      { id: 'another', status: 'ONLINE' },
      { id: 'chosen', status: 'OFFLINE' },
    ]);
    expect(selectedStockKiosk(options, 'chosen')?.id).toBe('chosen');
    expect(selectedStockKiosk(options, 'removed')?.id).toBe('another');
  });
  it('excludes disabled kiosks and handles no allocation', () => {
    const options = stockKioskOptions([{ id: 'disabled', status: 'DISABLED' }]);
    expect(options).toEqual([]);
    expect(selectedStockKiosk(options, 'disabled')).toBeUndefined();
  });
});
