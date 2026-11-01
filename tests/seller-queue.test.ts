import { describe, expect, it, vi } from 'vitest';
import { readSellerQueue } from '../apps/web/src/features/orders/seller-queue';
import {
  matchesOrderFilter,
  sellerOrderActionLabel,
} from '../apps/web/src/features/orders/orders.utils';
import type { WebOrder } from '../apps/web/src/features/orders/orders.types';
const row = (id: string) =>
  ({ id, state: 'REQUESTED', orderStatus: null, ready: false }) as WebOrder;
describe('Seller work queue', () => {
  it('follows hasMore, retains source pages for deep links and does not double count overlaps', async () => {
    const load = vi.fn(async (page: number) =>
      page === 1
        ? { items: [row('one')], page, hasMore: true }
        : { items: [row('one'), row('two')], page, hasMore: false },
    );
    const result = await readSellerQueue(load);
    expect(load.mock.calls).toEqual([[1], [2]]);
    expect(result.items.map(({ id, overviewPage }) => [id, overviewPage])).toEqual([
      ['one', 1],
      ['two', 2],
    ]);
    expect(result.hasMore).toBe(false);
  });
  it('marks a bounded collection partial, never complete', async () => {
    const result = await readSellerQueue(
      async (page) => ({ items: [row(String(page))], page, hasMore: true }),
      2,
    );
    expect(result).toMatchObject({ loadedPages: 2, hasMore: true });
  });
  it('rejects a broken later page rather than displaying an incomplete total as true', async () => {
    await expect(
      readSellerQueue(async (page) => {
        if (page === 2) throw new Error('Unavailable');
        return { items: [row('one')], page, hasMore: true };
      }),
    ).rejects.toThrow('Unavailable');
  });
  it('stops repeated or empty pages instead of looping on hasMore', async () => {
    await expect(
      readSellerQueue(async (page) => ({ items: [row('one')], page, hasMore: true })),
    ).rejects.toThrow('did not advance');
    await expect(
      readSellerQueue(async (page) => ({ items: [], page, hasMore: true })),
    ).rejects.toThrow('did not advance');
  });
  it('cancels a queue when navigation invalidates its query', async () => {
    const control = new AbortController();
    control.abort();
    const load = vi.fn();
    await expect(readSellerQueue(load, 50, control.signal)).rejects.toThrow();
    expect(load).not.toHaveBeenCalled();
  });
  it('separates unpaid orders from preparation and uses state-specific detail actions', () => {
    const unpaid = { ...row('one'), state: 'ORDERED', orderStatus: 'AWAITING_PAYMENT' };
    expect(matchesOrderFilter(unpaid, 'payment', 'seller')).toBe(true);
    expect(matchesOrderFilter(unpaid, 'preparing', 'seller')).toBe(false);
    expect(sellerOrderActionLabel(unpaid)).toBe('Theo dõi thanh toán');
    expect(sellerOrderActionLabel(row('two'))).toBe('Báo giá');
    expect(sellerOrderActionLabel({ ...unpaid, orderStatus: 'PAID' })).toBe('Chuẩn bị & nạp hoa');
    expect(sellerOrderActionLabel({ ...unpaid, orderStatus: 'PAID', ready: true })).toBe(
      'Theo dõi nhận hoa',
    );
    expect(sellerOrderActionLabel({ ...unpaid, orderStatus: 'COMPLETED' })).toBe('Xem đơn');
  });
});
