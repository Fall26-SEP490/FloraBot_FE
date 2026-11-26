import { describe, expect, it } from 'vitest';
import {
  sellerQuotePickupBounds,
  sellerQuotePickupError,
} from '../apps/web/src/features/orders/quote-pickup';

describe('seller quote pickup policy matching current BE', () => {
  const now = Date.parse('2026-11-26T12:17:00+07:00');
  it('blocks pickup in 13 minutes and accepts exactly one hour or later', () => {
    expect(sellerQuotePickupError('2026-11-26T12:30', now)).toContain('1 giờ');
    expect(sellerQuotePickupError('2026-11-26T13:16', now)).toContain('1 giờ');
    expect(sellerQuotePickupError('2026-11-26T13:17', now)).toBeNull();
    expect(sellerQuotePickupError('2026-11-26T13:30', now)).toBeNull();
  });
  it('revalidates against the submit time, even when a formerly valid draft has aged', () => {
    expect(sellerQuotePickupError('2026-11-26T13:17', now + 1000)).toContain('1 giờ');
  });
  it('accepts the 30-day boundary but rejects later, past, empty and invalid dates', () => {
    expect(sellerQuotePickupError('2026-12-26T12:17', now)).toBeNull();
    expect(sellerQuotePickupError('2026-12-26T12:18', now)).toContain('30 ngày');
    expect(sellerQuotePickupError('2026-11-26T12:00', now)).toContain('1 giờ');
    expect(sellerQuotePickupError('', now)).toContain('hợp lệ');
    expect(sellerQuotePickupError('2026-02-30T13:30', now)).toContain('hợp lệ');
  });
  it('rounds the minimum up to a selectable minute and handles Vietnam midnight', () => {
    expect(sellerQuotePickupBounds(now + 30000).min).toBe('2026-11-26T13:18');
    const late = Date.parse('2026-11-26T23:40:20+07:00');
    expect(sellerQuotePickupBounds(late).min).toBe('2026-11-27T00:41');
    expect(sellerQuotePickupBounds(late).max).toBe('2026-12-26T23:40');
    expect(sellerQuotePickupError('2026-11-27T00:41', late)).toBeNull();
  });
});
