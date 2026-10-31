import { accountPath } from '@/features/portal/config/roleRoutes';

export function postLoginPath(role: string, search: string): string {
  const target = new URLSearchParams(search).get('returnUrl');
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
