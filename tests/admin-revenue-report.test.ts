import { describe, expect, it } from 'vitest';
import {
  filterLoadedRevenue,
  revenueInteger,
  sumLoadedRevenue,
} from '../apps/web/src/features/dashboard/revenue-report.utils';

describe('Revenue amounts keep PostgreSQL integer precision', () => {
  it('accepts exact integer strings, including negative ledger adjustments', () => {
    expect(revenueInteger('9007199254740993')).toBe(9007199254740993n);
    expect(revenueInteger('-420000')).toBe(-420000n);
  });
  it('rejects unsafe numbers, fractions, missing data and malformed amounts', () => {
    for (const value of [9007199254740992, 1.5, NaN, Infinity, null, undefined, '1.5', 'invalid'])
      expect(revenueInteger(value)).toBeNull();
  });
  it('sums exact amounts without rounding and includes signed adjustments', () => {
    expect(
      sumLoadedRevenue([{ money: '9007199254740993' }, { money: 7 }, { money: '-3' }], 'money'),
    ).toBe(9007199254740997n);
  });
  it('does not silently replace an invalid row with zero', () => {
    expect(sumLoadedRevenue([{ money: 100 }, { money: null }], 'money')).toBeNull();
  });
});

describe('Filters apply only to the returned revenue dataset', () => {
  const rows = [
    { ngay: '2026-11-01', kiosk: 'K02', gmv: 100 },
    { ngay: '2026-11-02', kiosk: 'K01', gmv: 200 },
    { ngay: '2026-11-02', kiosk: 'K02', gmv: 300 },
  ];
  it('includes both date boundaries and restricts the selected kiosk', () => {
    expect(
      filterLoadedRevenue('v_revenue_daily', rows, {
        from: '2026-11-01',
        to: '2026-11-02',
        kiosk: 'K02',
      }).rows,
    ).toEqual([rows[2], rows[0]]);
  });
  it('sorts same-day kiosk rows deterministically without changing input', () => {
    expect(
      filterLoadedRevenue('v_revenue_daily', rows, { from: '', to: '', kiosk: '' }).rows,
    ).toEqual([rows[1], rows[2], rows[0]]);
    expect(rows[0].ngay).toBe('2026-11-01');
  });
  it('compares whole fee months, including the end month', () => {
    const result = filterLoadedRevenue(
      'v_platform_revenue',
      [{ thang: '2026-10-01' }, { thang: '2026-11-01' }, { thang: '2026-12-01' }],
      { from: '2026-10', to: '2026-11', kiosk: '' },
    );
    expect(result.rows).toEqual([{ thang: '2026-11-01' }, { thang: '2026-10-01' }]);
  });
  it('rejects an inverted range and excludes unknown periods when filtering', () => {
    expect(
      filterLoadedRevenue('v_revenue_daily', rows, {
        from: '2026-12-01',
        to: '2026-11-01',
        kiosk: '',
      }),
    ).toEqual({ rows: [], invalidRange: true });
    expect(
      filterLoadedRevenue('v_revenue_daily', [{}], { from: '2026-11-01', to: '', kiosk: '' }).rows,
    ).toEqual([]);
  });
});
