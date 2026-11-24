import {
  catalogQueryKeys,
  catalogReturnPath,
  isCatalogListingPath,
  shopCatalogSellerId,
} from '@/features/catalog/catalog.navigation';
import { accountPath } from '@/features/portal/config/roleRoutes';
import { validPaymentCode } from '@/features/orders/payment-return';

export function postLoginPath(role: string, search: string): string {
  const target = new URLSearchParams(search).get('returnUrl');
  if (target === '/thue-kiosk' && (role === 'CUSTOMER' || role === 'SELLER')) return target;
  if ((role === 'CUSTOMER' || role === 'SELLER') && target?.startsWith('/tai-khoan?')) {
    const code = validPaymentCode(
      new URLSearchParams(target.slice('/tai-khoan?'.length)).get('orderCode'),
    );
    if (code) return `/tai-khoan?orderCode=${code}`;
  }
  if (role === 'CUSTOMER' && target) {
    // Explicit account destinations only. Query identifiers are validated, hashes are allowlisted.
    const account =
      /^\/tai-khoan(?:\?([^#]*))?(?:#(overview|web-orders|member-orders|member-chats))?$/.exec(
        target,
      );
    if (account) {
      const params = new URLSearchParams(account[1] ?? '');
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (
        [...params.keys()].every((key) => {
          if (params.getAll(key).length !== 1) return false;
          const value = params.get(key) ?? '';
          if (key === 'requestId') return uuidPattern.test(value.replace(/^purchase-/, ''));
          return (
            (key === 'chat' && uuidPattern.test(value)) ||
            (key === 'page' && /^[1-9]\d{0,4}$/.test(value)) ||
            (key === 'filter' &&
              [
                'all',
                'attention',
                'requested',
                'quoted',
                'payment',
                'preparing',
                'ready',
                'closed',
              ].includes(value))
          );
        })
      )
        return target;
    }

    const uuid = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
    const orderPath = new RegExp(`^/dat-hoa/${uuid}/${uuid}\\?`, 'i');
    if (orderPath.test(target)) {
      const params = new URLSearchParams(target.slice(target.indexOf('?') + 1));
      const from = params.get('from');
      if (
        params.get('order') === '1' &&
        (!params.has('zone') || params.get('zone') === 'PREORDER') &&
        (!from || catalogReturnPath(from) === from) &&
        [...params.keys()].every(
          (key) => ['order', 'zone', 'from'].includes(key) && params.getAll(key).length === 1,
        )
      )
        return target;
    }
    const separator = target.indexOf('?');
    const pathname = target.slice(0, separator);
    if (separator !== -1 && isCatalogListingPath(pathname) && !target.includes('#')) {
      const params = new URLSearchParams(target.slice(separator + 1));
      const allowed: readonly string[] = [
        'action',
        'sellerId',
        'productId',
        'shopName',
        'name',
        ...catalogQueryKeys,
      ];
      const idPattern = new RegExp(`^${uuid}$`, 'i');
      const sellerId = params.get('sellerId') ?? '';
      const storefrontSellerId = shopCatalogSellerId(pathname);
      if (
        params.get('action') === 'chat' &&
        idPattern.test(sellerId) &&
        idPattern.test(params.get('productId') ?? '') &&
        (!storefrontSellerId || storefrontSellerId === sellerId.toLowerCase()) &&
        [...params.keys()].every(
          (key) => allowed.includes(key) && (key === 'tag' || params.getAll(key).length === 1),
        )
      )
        return target;
    }
  }
  // Only the canonical internal kiosk-support route may survive customer sign-in.
  if (
    role === 'CUSTOMER' &&
    target &&
    /^\/ho-tro-cua-hang\?kiosk=[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      target,
    )
  )
    return target;
  // Profile's sign-in links are supported explicitly; never redirect to user-supplied URLs.
  return target === '/ho-so' || target === '/ho-so#security' ? target : accountPath(role);
}
