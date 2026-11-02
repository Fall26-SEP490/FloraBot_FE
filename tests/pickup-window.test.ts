import { describe, expect, it } from 'vitest';
import { pickupWindow } from '../apps/web/src/features/orders/pickup-window';
describe('Pickup time guidance never changes order status', () => {
  const start = '2030-11-10T03:00:00Z';
  const end = '2030-11-10T05:00:00Z';
  it.each([
    ['2030-11-10T02:59:59Z', 'early'],
    [start, 'within'],
    ['2030-11-10T04:59:59Z', 'within'],
    [end, 'expired'],
    ['2030-11-11T00:00:00Z', 'expired'],
  ])('%s maps to %s', (now, expected) =>
    expect(pickupWindow(start, end, Date.parse(now))).toBe(expected),
  );
  it.each([
    ['', end],
    [start, ''],
    ['invalid', end],
    [end, start],
    [start, start],
  ])('missing or inconsistent dates stay unknown', (from, to) =>
    expect(pickupWindow(from, to, Date.now())).toBe('unknown'),
  );
});
