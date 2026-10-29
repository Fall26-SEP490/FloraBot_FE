import { accountPath } from '@/features/portal/config/roleRoutes';

export function postLoginPath(role: string, search: string): string {
  const target = new URLSearchParams(search).get('returnUrl');
  // Profile's sign-in links are supported explicitly; never redirect to user-supplied URLs.
  return target === '/ho-so' || target === '/ho-so#security' ? target : accountPath(role);
}
