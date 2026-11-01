import { expect, it } from 'vitest';
import { postLoginPath } from '../apps/web/src/features/auth/auth.utils';

it('preserves the product chat context without accepting extra destinations', () => {
  const target =
    '/dat-hoa?action=chat&sellerId=20000000-0000-0000-0000-000000000001&productId=30000000-0000-0000-0000-000000000001&shopName=Shop&name=Hoa';
  expect(postLoginPath('CUSTOMER', '?returnUrl=' + encodeURIComponent(target))).toBe(target);
  expect(
    postLoginPath(
      'CUSTOMER',
      '?returnUrl=' + encodeURIComponent(target + '&redirect=//evil.example'),
    ),
  ).toBe('/tai-khoan');
});

it('resumes the selected flower for customers, and rejects extra redirect parameters', () => {
  const target =
    '/dat-hoa/30000000-0000-0000-0000-000000000001/40000000-0000-0000-0000-000000000001?order=1&zone=PREORDER';
  expect(postLoginPath('CUSTOMER', '?returnUrl=' + encodeURIComponent(target))).toBe(target);
  expect(postLoginPath('SELLER', '?returnUrl=' + encodeURIComponent(target))).toBe('/seller');
  expect(
    postLoginPath(
      'CUSTOMER',
      '?returnUrl=' + encodeURIComponent(target + '&redirect=//evil.example'),
    ),
  ).toBe('/tai-khoan');
});

it.each(['CUSTOMER', 'SELLER', 'ADMIN', 'OPERATIONS_MANAGER', 'TECHNICIAN', 'SELLER_STAFF'])(
  '%s returns to profile after signing in from the profile page',
  (role) => {
    expect(postLoginPath(role, '?returnUrl=/ho-so')).toBe('/ho-so');
    expect(postLoginPath(role, '?returnUrl=%2Fho-so%23security')).toBe('/ho-so#security');
  },
);
it.each([
  'https://evil.example',
  '//evil.example',
  '/\\evil.example',
  'javascript:alert(1)',
  '/admin',
  '/ho-so?redirect=evil',
])('does not follow an unapproved return URL: %s', (target) => {
  expect(postLoginPath('CUSTOMER', `?returnUrl=${encodeURIComponent(target)}`)).toBe('/tai-khoan');
  expect(postLoginPath('ADMIN', `?returnUrl=${encodeURIComponent(target)}`)).toBe('/admin');
});

it('returns a customer to the exact kiosk support page without allowing external redirects', () => {
  const target = '/ho-tro-cua-hang?kiosk=40000000-0000-0000-0000-000000000001';
  expect(postLoginPath('CUSTOMER', '?returnUrl=' + encodeURIComponent(target))).toBe(target);
  expect(postLoginPath('ADMIN', '?returnUrl=' + encodeURIComponent(target))).toBe('/admin');
  expect(
    postLoginPath(
      'CUSTOMER',
      '?returnUrl=' + encodeURIComponent(target + '&redirect=https://evil.example'),
    ),
  ).toBe('/tai-khoan');
});
