import { describe, expect, it } from 'vitest';
import {
  sellerReportPeriod,
  leaseDaysRemaining,
  vietnamToday,
} from '../apps/web/src/features/dashboard/seller-report.utils';

describe('Admin seller report periods', () => {
  it('covers the full Vietnamese calendar month, including leap day', () => {
    expect(sellerReportPeriod('month', '2024-02', '', '')).toEqual({
      from: '2024-02-01T00:00:00+07:00',
      to: '2024-02-29T23:59:59.999999+07:00',
    });
  });
  it('covers December without drifting into another year', () => {
    expect(sellerReportPeriod('month', '2026-12', '', '')?.to).toBe(
      '2026-12-31T23:59:59.999999+07:00',
    );
  });
  it('rejects inverted ranges and impossible dates rather than rolling them over', () => {
    for (const [from, to] of [
      ['2026-11-20', '2026-11-01'],
      ['2026-02-30', '2026-03-01'],
      ['', '2026-11-01'],
    ])
      expect(sellerReportPeriod('range', '', from, to)).toBeNull();
    expect(sellerReportPeriod('month', '2026-13', '', '')).toBeNull();
  });
  it('retains the last microsecond for the inclusive BE upper bound', () => {
    expect(sellerReportPeriod('range', '', '2026-11-17', '2026-11-17')).toEqual({
      from: '2026-11-17T00:00:00+07:00',
      to: '2026-11-17T23:59:59.999999+07:00',
    });
  });
  it('counts seven-day warnings using Vietnam dates across a UTC date boundary', () => {
    const now = new Date('2026-11-16T17:30:00Z');
    expect(vietnamToday(now)).toBe('2026-11-17');
    expect(leaseDaysRemaining('2026-11-24', now)).toBe(7);
    expect(leaseDaysRemaining('2026-11-17', now)).toBe(0);
    expect(leaseDaysRemaining('2026-11-16', now)).toBe(-1);
    expect(leaseDaysRemaining('invalid', now)).toBeNull();
  });
});

it('uses the exact lease expiry timestamp for the seven-day window', () => {
  const now = new Date('2026-11-18T00:00:00Z');
  expect(leaseDaysRemaining('2026-11-25T00:00:00Z', now)).toBe(7);
  expect(leaseDaysRemaining('2026-11-25T00:00:01Z', now)).toBe(8);
  expect(leaseDaysRemaining('2026-11-17T23:59:59Z', now)).toBe(-1);
});
