import type { OrderPage, WebOrder } from './orders.types';

export type SellerQueueOrder = WebOrder & { overviewPage: number };
export const SELLER_RESULT_SIZE = 20;
export const sellerQueueKey = (base: string, limit = 50) => [
  'web-orders',
  base,
  'seller-queue',
  limit,
];

/** Follow hasMore. A partial result is explicit; malformed/repeating pages are errors. */
export async function readSellerQueue(
  fetchPage: (page: number) => Promise<OrderPage>,
  limit = 50,
  signal?: AbortSignal,
) {
  const rows = new Map<string, SellerQueueOrder>();
  let hasMore = true;
  let loadedPages = 0;
  for (let page = 1; hasMore && page <= limit; page++) {
    signal?.throwIfAborted();
    const result = await fetchPage(page);
    signal?.throwIfAborted();
    if (!Array.isArray(result.items) || typeof result.hasMore !== 'boolean')
      throw new Error('Invalid seller order page');
    let added = 0;
    for (const row of result.items) {
      if (!row.id) throw new Error('Missing seller order identity');
      if (!rows.has(row.id)) {
        rows.set(row.id, { ...row, overviewPage: page });
        added++;
      }
    }
    if (result.hasMore && added === 0) throw new Error('Seller order pagination did not advance');
    loadedPages = page;
    hasMore = result.hasMore;
  }
  return { items: [...rows.values()], page: 1, hasMore, loadedPages };
}
