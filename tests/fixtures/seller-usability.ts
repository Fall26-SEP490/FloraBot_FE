import type { Page } from '@playwright/test';
export const shopId = '20000000-0000-0000-0000-000000000001';
export const kioskId = '40000000-0000-0000-0000-000000000001';
export const productId = '30000000-0000-0000-0000-000000000001';
export const sampleProduct = {
  id: productId,
  name: 'Mẫu kiểm thử Seller',
  status: 'ACTIVE',
  price: 350000,
  tags: ['hoa lụa'],
  description: 'Mẫu trong danh mục kiểm thử',
  inventoryKind: 'ARTIFICIAL',
  lengthCm: 25,
  widthCm: 15,
  heightCm: 35,
};
const pickupAt = new Date(Date.now() + 24 * 3600000).toISOString();
export const sampleRequest = {
  id: '70000000-0000-0000-0000-000000000001',
  kind: 'CUSTOM',
  state: 'REQUESTED',
  orderStatus: null,
  ready: false,
  sellerId: shopId,
  kioskId,
  productId,
  productName: sampleProduct.name,
  kioskName: 'Tủ kiểm thử Seller',
  address: 'Địa chỉ kiểm thử',
  pickupAt,
  pickupBefore: new Date(Date.now() + 26 * 3600000).toISOString(),
  quoteExpiresAt: new Date(Date.now() + 12 * 3600000).toISOString(),
  instructions: 'Mong muốn kiểm thử',
  quotedPrice: null,
  orderId: null,
  orderCode: null,
  checkoutId: null,
  trackingToken: null,
};
export async function setupSellerUsability(page: Page) {
  const model = {
    products: [{ ...sampleProduct }],
    empty: false,
    fail: new Set<string>(),
    pagedOrders: false,
    role: 'SELLER',
    sellerStatus: 'ACTIVE',
    writes: [] as { path: string; body: unknown }[],
    reads: [] as string[],
    allowCreate: false,
  };
  await page.route('**/hub/**', (route) => route.fulfill({ status: 503 }));
  await page.route('**/api/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname.replace(/^\/api/, '');
    if (req.method() !== 'GET') {
      const body = req.postDataJSON();
      model.writes.push({ path, body });
      if (model.allowCreate && path === '/me/products' && req.method() === 'POST') {
        const id = '30000000-0000-0000-0000-000000000099';
        model.products.push({ ...sampleProduct, ...body, id, status: 'DRAFT' });
        return route.fulfill({ status: 201, json: { id } });
      }
      return route.fulfill({ status: 405, json: { detail: 'Test không cho phép thao tác này' } });
    }
    model.reads.push(path + url.search);
    if (model.fail.has(path))
      return route.fulfill({ status: 503, json: { detail: 'Dịch vụ kiểm thử tạm gián đoạn' } });
    const list = (items: unknown[]) => (model.empty ? [] : items);
    const paged = (items: unknown[]) => ({ items: list(items), page: 1, hasMore: false });
    if (path === '/auth/me')
      return route.fulfill({
        json: {
          id: 'seller-ui-user',
          name: 'Chủ shop kiểm thử',
          role: model.role,
          sellerId: shopId,
          sellerStatus: model.sellerStatus,
          packageExpiresAt: '2099-01-01',
        },
      });
    if (path === '/me/products') return route.fulfill({ json: model.empty ? [] : model.products });
    if (path === `/sellers/${shopId}/preorders`) {
      const current = Number(url.searchParams.get('page') || 1);
      return route.fulfill({
        json: model.pagedOrders
          ? {
              items: model.empty
                ? []
                : current === 1
                  ? [
                      {
                        ...sampleRequest,
                        id: 'request-closed',
                        orderStatus: 'COMPLETED',
                        state: 'ACCEPTED',
                      },
                    ]
                  : [sampleRequest],
              page: current,
              hasMore: current === 1,
            }
          : paged([sampleRequest]),
      });
    }
    if (path === `/sellers/${shopId}/kiosks` || path === '/me/kiosks')
      return route.fulfill({
        json: list([
          {
            id: kioskId,
            code: 'K-UI-SELLER',
            name: 'Tủ kiểm thử Seller',
            status: 'ONLINE',
            sellerId: shopId,
            slotCount: 2,
            address: 'Địa chỉ kiểm thử',
            region: 'HCM',
            latitude: 10.78,
            longitude: 106.69,
            coordinates: { latitude: 10.78, longitude: 106.69 },
            locationComplete: true,
            canEditLocation: true,
          },
        ]),
      });
    if (path === `/me/kiosks/${kioskId}/slots`)
      return route.fulfill({
        json: list([
          {
            id: '60000000-0000-0000-0000-000000000001',
            kioskId,
            slotCode: 'A01',
            zone: 'WALK_IN',
            status: 'RENTED_EMPTY',
            bouquetId: null,
            productId: null,
            kioskName: 'Tủ kiểm thử Seller',
          },
        ]),
      });
    if (path.endsWith('/photos')) return route.fulfill({ json: paged([]) });
    if (path === `/sellers/${shopId}/reports/sales`)
      return route.fulfill({
        json: {
          sellerId: shopId,
          from: null,
          to: null,
          grossPaid: 1350000,
          totalRefunded: 100000,
          netReceipts: 1250000,
          paidOrders: 3,
          unclaimedOrders: 0,
          pendingAmount: 0,
          byKiosk: [],
        },
      });
    if (path === `/sellers/${shopId}/payment-channel`)
      return route.fulfill({
        json: {
          sellerId: shopId,
          version: 1,
          state: 'ACTIVE',
          expectedBankBin: '9704',
          expectedBankAccountMasked: '***1234',
          expectedBankName: 'Vietcombank',
        },
      });
    if (path === `/sellers/${shopId}/payments`)
      return route.fulfill({ json: { payments: [], page: 1, pageSize: 10, hasMore: false } });
    if (path === `/sellers/${shopId}/loyalty-settings`)
      return route.fulfill({
        json: {
          sellerId: shopId,
          enabled: true,
          earnRatePercent: 1,
          minRedeemPoints: 10000,
          maxRedeemPercent: 20,
        },
      });
    if (path === `/sellers/${shopId}/wallet`)
      return route.fulfill({
        json: {
          balance: { availableBalance: 1250000, pendingBalance: 350000, debt: 0 },
          minimumWithdrawal: 50000,
          bankConfigured: false,
          entries: [],
          withdrawals: [],
          hasMoreEntries: false,
          hasMoreWithdrawals: false,
        },
      });
    if (path === `/sellers/${shopId}/subscriptions`)
      return route.fulfill({
        json: {
          package: {
            id: 'test-package',
            name: 'Gói kiểm thử',
            monthlyFee: 100000,
            maxSlots: 2,
            status: 'ACTIVE',
          },
          subscriptions: [],
        },
      });
    if (path.endsWith('/staff/accounts') || path.endsWith('/staff'))
      return route.fulfill({
        json: list([
          {
            id: 'test-staff',
            email: 'staff@example.test',
            fullName: 'Nhân viên kiểm thử',
            name: 'Nhân viên kiểm thử',
            status: 'ACTIVE',
            role: 'SELLER_STAFF',
            phone: null,
            createdAt: '2026-10-10T00:00:00Z',
          },
        ]),
      });
    if (path.endsWith('/staff-tasks') || path.endsWith('/staff-delivery-scopes'))
      return route.fulfill({ json: path.endsWith('/staff-tasks') ? paged([]) : [] });
    if (path.endsWith('/seller-staff/chats') || path.endsWith('/chats'))
      return route.fulfill({ json: paged([]) });
    if (path === '/member/kiosk-applications/current')
      return route.fulfill({ status: 404, json: { detail: 'Chưa có hồ sơ thuê đang mở' } });
    if (path === `/sellers/${shopId}/refunds`) return route.fulfill({ json: paged([]) });
    if (path === `/sellers/${shopId}/ai/seasonal-sales`)
      return route.fulfill({
        json: {
          sellerId: shopId,
          from: '2025-11-07',
          to: '2026-11-07',
          totalInvoices: 12,
          totalUnits: 15,
          products: [],
        },
      });
    if (path.endsWith('/termination-requests/current'))
      return route.fulfill({ status: 404, json: { detail: 'Chưa có yêu cầu chấm dứt' } });
    if (path.endsWith('/accessories')) return route.fulfill({ json: [] });
    return route.fulfill({ status: 501, json: { detail: 'Chưa khai báo GET mock: ' + path } });
  });
  return model;
}
