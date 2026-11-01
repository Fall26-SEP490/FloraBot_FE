import { catalogQueryKeys, catalogReturnPath } from '@/features/catalog/catalog.navigation';
import { accountPath } from '@/features/portal/config/roleRoutes';

export function postLoginPath(role: string, search: string): string {
  const target = new URLSearchParams(search).get('returnUrl');
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
        [...params.keys()].every(
          (key) =>
            params.getAll(key).length === 1 &&
            ((['requestId', 'chat'].includes(key) && uuidPattern.test(params.get(key) ?? '')) ||
              (key === 'page' && /^[1-9]\d{0,4}$/.test(params.get(key) ?? '')) ||
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
                ].includes(params.get(key) ?? ''))),
        )
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
    if (target.startsWith('/dat-hoa?')) {
      const params = new URLSearchParams(target.slice('/dat-hoa?'.length));
      const allowed: readonly string[] = [
        'action',
        'sellerId',
        'productId',
        'shopName',
        'name',
        ...catalogQueryKeys,
      ];
      const idPattern = new RegExp(`^${uuid}$`, 'i');
      if (
        params.get('action') === 'chat' &&
        idPattern.test(params.get('sellerId') ?? '') &&
        idPattern.test(params.get('productId') ?? '') &&
        [...params.keys()].every((key) => allowed.includes(key) && params.getAll(key).length === 1)
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
