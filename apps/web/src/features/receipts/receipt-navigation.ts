import { orderReturnHref, orderReturnPath } from '../orders/order-navigation';

const stateKey = 'florabotReceiptView';
const pendingKey = 'florabotReceiptNavigation';
const maxAge = 2 * 60 * 60 * 1000;
const idPattern = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const tokenPattern = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/;

export type ReceiptContext = { orderId: string; token: string; returnTo: string | null };

export function readReceiptContext(): ReceiptContext {
  const params = new URLSearchParams(window.location.hash.slice(1));
  if (params.has('order') || params.has('token')) {
    const requestId = params.get('request');
    return {
      orderId: params.get('order') ?? '',
      token: params.get('token') ?? '',
      returnTo:
        orderReturnPath(params.get('from')) ??
        (requestId && idPattern.test(requestId) ? orderReturnHref(requestId) : null),
    };
  }
  const saved = window.history.state?.[stateKey];
  if (
    saved &&
    saved.path === window.location.pathname &&
    typeof saved.orderId === 'string' &&
    idPattern.test(saved.orderId) &&
    typeof saved.token === 'string' &&
    tokenPattern.test(saved.token) &&
    Number.isFinite(saved.savedAt) &&
    Date.now() - saved.savedAt >= 0 &&
    Date.now() - saved.savedAt <= maxAge
  ) {
    return {
      orderId: saved.orderId,
      token: saved.token,
      returnTo: orderReturnPath(saved.returnTo),
    };
  }
  try {
    const pending = JSON.parse(sessionStorage.getItem(pendingKey) ?? 'null');
    if (
      pending?.path === window.location.pathname &&
      typeof pending.orderId === 'string' &&
      idPattern.test(pending.orderId) &&
      typeof pending.token === 'string' &&
      tokenPattern.test(pending.token) &&
      Number.isFinite(pending.savedAt) &&
      Date.now() >= pending.savedAt &&
      Date.now() - pending.savedAt < 30_000
    )
      return {
        orderId: pending.orderId,
        token: pending.token,
        returnTo: orderReturnPath(pending.returnTo),
      };
  } catch {
    /* The user can still enter the receipt manually. */
  }
  return { orderId: '', token: '', returnTo: null };
}

export function rememberReceiptContext(context: ReceiptContext) {
  const orderId = context.orderId.trim();
  const token = context.token.trim().toUpperCase();
  const valid = idPattern.test(orderId) && tokenPattern.test(token);
  try {
    sessionStorage.removeItem(pendingKey);
  } catch {
    /* No session storage. */
  }
  // Keep access on this history entry only: reload/Back work without putting codes
  // back in the URL, localStorage or a shared "last opened order" pointer.
  window.history.replaceState(
    {
      ...window.history.state,
      [stateKey]: valid
        ? {
            orderId,
            token,
            returnTo: orderReturnPath(context.returnTo),
            path: window.location.pathname,
            savedAt: Date.now(),
          }
        : null,
    },
    '',
    window.location.pathname,
  );
}

export function transferReceiptContext(
  path: '/receipt' | '/phan-anh',
  orderId: string,
  token: string,
  returnTo: string | null,
) {
  try {
    sessionStorage.setItem(
      pendingKey,
      JSON.stringify({
        path,
        orderId: orderId.trim(),
        token: token.trim().toUpperCase(),
        returnTo: orderReturnPath(returnTo),
        savedAt: Date.now(),
      }),
    );
  } catch {
    /* The destination offers manual lookup. */
  }
}
