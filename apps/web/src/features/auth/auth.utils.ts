import { accountPath } from '@/features/portal/config/roleRoutes';

export function postLoginPath(role: string, search: string): string {
  const target = new URLSearchParams(search).get('returnUrl');
  if (role === 'CUSTOMER' && target) {
    const uuid = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
    const orderPath = new RegExp(`^/dat-hoa/${uuid}/${uuid}\\?order=1(?:&zone=PREORDER)?$`, 'i');
    if (orderPath.test(target)) return target;
    if (target.startsWith('/dat-hoa?')) {
      const params = new URLSearchParams(target.slice('/dat-hoa?'.length));
      const allowed = ['action', 'sellerId', 'productId', 'shopName', 'name'];
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
