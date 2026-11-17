import type { OrderFilter } from './orders.types';

const stateKey = 'florabotOrderView';
const maxAge = 2 * 60 * 60 * 1000;
export const ORDER_FILTERS: readonly OrderFilter[] = [
  'all',
  'attention',
  'tracking',
  'requested',
  'quoted',
  'payment',
  'preparing',
  'ready',
  'closed',
];

const filters = ORDER_FILTERS;

export function orderReturnPath(value: string | null): string | null {
  if (!value || !value.startsWith('/tai-khoan?') || value.includes('\\')) return null;
  const url = new URL(value, 'https://florabot.invalid');
  const id = url.searchParams.get('requestId');
  if (
    url.pathname !== '/tai-khoan' ||
    url.hash !== '#web-orders' ||
    !id ||
    !/^[a-zA-Z0-9-]{1,80}$/.test(id)
  )
    return null;
  const params = new URLSearchParams({ requestId: id });
  const page = Number(url.searchParams.get('page'));
  if (Number.isSafeInteger(page) && page > 1 && page <= 100000) params.set('page', String(page));
  const filter = filters.find((item) => item === url.searchParams.get('filter'));
  if (filter && filter !== 'all') params.set('filter', filter);
  return `/tai-khoan?${params}#web-orders`;
}

export function orderReturnHref(requestId: string, page = 1, filter: OrderFilter = 'all') {
  const params = new URLSearchParams({ requestId });
  if (page > 1) params.set('page', String(page));
  if (filter !== 'all') params.set('filter', filter);
  return orderReturnPath(`/tai-khoan?${params}#web-orders`) ?? '/tai-khoan#web-orders';
}

export function rememberOrderView(requestId: string | null, page: number, filter: OrderFilter) {
  const params = new URLSearchParams();
  if (page > 1) params.set('page', String(page));
  const href = requestId
    ? orderReturnHref(requestId, page, filter)
    : `/tai-khoan${params.size ? '?' + params : ''}#web-orders`;
  window.history.replaceState(
    {
      ...window.history.state,
      [stateKey]: { requestId, page, scrollY: window.scrollY, savedAt: Date.now() },
    },
    '',
    href,
  );
  if (requestId) {
    try {
      sessionStorage.setItem(
        `${stateKey}:${requestId}:${page}`,
        JSON.stringify({
          requestId,
          page,
          scrollY: window.scrollY,
          savedAt: Date.now(),
        }),
      );
    } catch {
      // The URL and the source history entry still identify the order.
    }
  }
}

export function readOrderScroll(requestId: string, page: number): number | null {
  let value = window.history.state?.[stateKey];
  if (value?.requestId !== requestId || value?.page !== page) {
    try {
      value = JSON.parse(sessionStorage.getItem(`${stateKey}:${requestId}:${page}`) ?? 'null');
    } catch {
      return null;
    }
  }
  return value &&
    value.requestId === requestId &&
    value.page === page &&
    Number.isFinite(value.scrollY) &&
    value.scrollY >= 0 &&
    Number.isFinite(value.savedAt) &&
    Date.now() - value.savedAt >= 0 &&
    Date.now() - value.savedAt <= maxAge
    ? value.scrollY
    : null;
}
