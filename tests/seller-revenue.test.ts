import { describe, it, expect } from 'vitest';
import {
  vietnamMonth,
  revenueBuckets,
  loadRevenueBuckets,
} from '../apps/web/src/features/dashboard/seller-revenue.utils';

describe('seller revenue periods', () => {
  it('uses the Vietnamese month across a UTC month boundary', () => {
    expect(vietnamMonth(new Date('2026-10-31T18:00:00Z'))).toBe('2026-11');
  });
  it('builds twelve exact calendar months and handles leap days', () => {
    expect(revenueBuckets('month', '2026', '2026-11')).toHaveLength(12);
    const leap = revenueBuckets('day', '2024', '2024-02');
    expect(leap).toHaveLength(29);
    const last = new URLSearchParams(leap[28].params);
    expect(last.get('from')).toBe('2024-02-29T00:00:00+07:00');
    expect(last.get('to')).toBe('2024-02-29T23:59:59.999999+07:00');
    expect(revenueBuckets('day', '2026', '2026-02')).toHaveLength(28);
  });
  it('limits concurrent reads to four and preserves chronological order', async () => {
    let active = 0;
    let peak = 0;
    const rows = await loadRevenueBuckets(
      revenueBuckets('month', '2026', '2026-11'),
      async (params) => {
        peak = Math.max(peak, ++active);
        await new Promise((resolve) => setTimeout(resolve, 2));
        active--;
        return params;
      },
      new AbortController().signal,
    );
    expect(peak).toBe(4);
    expect(rows[0]).toBe('month=2026-01');
    expect(rows[11]).toBe('month=2026-12');
  });
  it('does not turn a failed or cancelled period into zero revenue', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      loadRevenueBuckets(
        revenueBuckets('day', '2026', '2026-11'),
        async () => 1,
        controller.signal,
      ),
    ).rejects.toThrow();
    await expect(
      loadRevenueBuckets(
        revenueBuckets('month', '2026', '2026-11'),
        async () => {
          throw new Error('offline');
        },
        new AbortController().signal,
      ),
    ).rejects.toThrow('offline');
  });
});
