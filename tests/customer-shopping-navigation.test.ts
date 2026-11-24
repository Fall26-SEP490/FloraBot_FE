import { describe, expect, it } from 'vitest';
import {
  readCatalogQuery,
  catalogReturnPath,
  shopCatalogPath,
} from '../apps/web/src/features/catalog/catalog.navigation';
import { customerOrderActionLabel } from '../apps/web/src/features/orders/orders.utils';
import { postLoginPath } from '../apps/web/src/features/auth/auth.utils';

describe('catalog navigation state', () => {
  it('keeps searchable filters and the selected page in a canonical internal URL', () => {
    const path =
      '/dat-hoa?search=H%E1%BB%93ng&price=under300&shop=Shop+A&kiosk=T%E1%BB%A7+1&mode=custom&sort=price-desc&page=2';
    expect(catalogReturnPath(path)).toBe(path);
    expect(readCatalogQuery(new URLSearchParams(path.split('?')[1]))).toMatchObject({
      search: 'Hồng',
      priceFilter: 'under300',
      shopFilter: 'Shop A',
      kioskFilter: 'Tủ 1',
      availabilityFilter: 'custom',
      sortBy: 'price-desc',
      page: 2,
    });
  });
  it('normalizes invalid state and strips control characters from text', () => {
    expect(
      readCatalogQuery(
        new URLSearchParams({
          page: 'NaN',
          mode: 'ready',
          price: 'free',
          sort: 'invalid',
          search: 'hoa\ntrắng',
        }),
      ),
    ).toMatchObject({
      page: 1,
      availabilityFilter: 'all',
      priceFilter: 'all',
      sortBy: 'default',
      search: 'hoatrắng',
    });
    expect(readCatalogQuery(new URLSearchParams('page=-1')).page).toBe(1);
    expect(readCatalogQuery(new URLSearchParams('page=2.5')).page).toBe(1);
  });
  it('keeps preorder status, budget and occasion in the product return path', () => {
    const path = '/dat-hoa?price=100to200&preorder=1&tag=occasion%3Abirthday';
    expect(catalogReturnPath(path)).toBe(path);
    expect(readCatalogQuery(new URLSearchParams(path.split('?')[1]))).toMatchObject({
      priceFilter: '100to200',
      preorderOnly: true,
      tags: ['occasion:birthday'],
    });
    expect(catalogReturnPath('/dat-hoa?preorder=1&preorder=0')).toBe('/dat-hoa');
  });
  it('keeps rating thresholds in the return path and ignores unsupported scores', () => {
    const path = '/dat-hoa?productRating=4&shopRating=5&page=2';
    expect(catalogReturnPath(path)).toBe(path);
    expect(readCatalogQuery(new URLSearchParams(path.split('?')[1]))).toMatchObject({
      productRating: '4',
      shopRating: '5',
    });
    expect(catalogReturnPath('/dat-hoa?productRating=4.5&shopRating=6')).toBe('/dat-hoa');
  });
  it('preserves filters on a storefront but rejects invalid shop paths', () => {
    const path = shopCatalogPath('20000000-0000-0000-0000-000000000001');
    expect(path).toBe('/dat-hoa/cua-hang/20000000-0000-0000-0000-000000000001');
    expect(catalogReturnPath(path + '?search=Hoa+hong&page=2')).toBe(
      path + '?search=Hoa+hong&page=2',
    );
    expect(catalogReturnPath('/dat-hoa/cua-hang/../../../admin')).toBe('/dat-hoa');
  });
  it.each([
    'https://evil.test',
    '//evil.test',
    '/dat-hoa/../admin',
    '/dat-hoa?redirect=//evil.test',
    '/dat-hoa?page=2&page=3',
    '/dat-hoa#bad',
  ])('rejects unsafe or unrelated return locations: %s', (path) => {
    expect(catalogReturnPath(path)).toBe('/dat-hoa');
  });
});
describe('customer next action', () => {
  const row = { state: 'REQUESTED', orderStatus: null, ready: false };
  it('distinguishes quote, payment, pickup and ended orders without performing an action', () => {
    expect(customerOrderActionLabel(row)).toBe('Xem tiến độ');
    expect(customerOrderActionLabel({ ...row, state: 'QUOTED' })).toBe('Xem báo giá');
    expect(customerOrderActionLabel({ ...row, orderStatus: 'AWAITING_PAYMENT' })).toBe(
      'Xem thanh toán',
    );
    expect(customerOrderActionLabel({ ...row, orderStatus: 'PAID', ready: true })).toBe(
      'Xem hướng dẫn nhận',
    );
    expect(customerOrderActionLabel({ ...row, orderStatus: 'COMPLETED', ready: true })).toBe(
      'Xem lại đơn',
    );
    expect(customerOrderActionLabel({ ...row, orderStatus: 'DISPENSE_FAILED' })).toBe(
      'Theo dõi xử lý',
    );
  });
});
describe('protected customer return after login', () => {
  const id = '30000000-0000-0000-0000-000000000001';
  it.each([
    '/tai-khoan#web-orders',
    '/tai-khoan#member-orders',
    `/tai-khoan?requestId=${id}#web-orders`,
    `/tai-khoan?chat=${id}#member-chats`,
    '/tai-khoan?page=2&filter=payment#web-orders',
  ])('preserves allowed account paths: %s', (path) => {
    expect(postLoginPath('CUSTOMER', '?returnUrl=' + encodeURIComponent(path))).toBe(path);
    expect(postLoginPath('ADMIN', '?returnUrl=' + encodeURIComponent(path))).toBe('/admin');
  });
  it.each([
    '/tai-khoan?redirect=//evil.test#web-orders',
    '/tai-khoan?chat=invalid#member-chats',
    '/tai-khoan#admin',
    '/tai-khoan?filter=evil',
    '/tai-khoan?page=2&page=3',
  ])('rejects extra parameters and untrusted identifiers: %s', (path) => {
    expect(postLoginPath('CUSTOMER', '?returnUrl=' + encodeURIComponent(path))).toBe('/tai-khoan');
  });
});

it('keeps the filtered catalog through quotation sign-in without accepting arbitrary return paths', () => {
  const product =
    '/dat-hoa/30000000-0000-0000-0000-000000000001/40000000-0000-0000-0000-000000000001';
  const target = product + '?order=1&from=' + encodeURIComponent('/dat-hoa?price=under300&page=2');
  expect(postLoginPath('CUSTOMER', '?returnUrl=' + encodeURIComponent(target))).toBe(target);
  expect(
    postLoginPath(
      'CUSTOMER',
      '?returnUrl=' + encodeURIComponent(product + '?order=1&from=https://evil.test'),
    ),
  ).toBe('/tai-khoan');
});

it('resumes a quote or shop chat at the storefront that originated it', () => {
  const sellerId = '20000000-0000-0000-0000-000000000001';
  const productId = '30000000-0000-0000-0000-000000000001';
  const storefront = shopCatalogPath(sellerId);
  const from = storefront + '?price=under100';
  const quote =
    `/dat-hoa/${productId}/40000000-0000-0000-0000-000000000001?order=1&from=` +
    encodeURIComponent(from);
  const chat = `${from}&action=chat&sellerId=${sellerId}&productId=${productId}`;
  for (const returning of [quote, chat]) {
    expect(postLoginPath('CUSTOMER', '?returnUrl=' + encodeURIComponent(returning))).toBe(
      returning,
    );
  }
  const otherSeller = chat.replace(
    'sellerId=' + sellerId,
    'sellerId=20000000-0000-0000-0000-000000000002',
  );
  expect(postLoginPath('CUSTOMER', '?returnUrl=' + encodeURIComponent(otherSeller))).toBe(
    '/tai-khoan',
  );
});
