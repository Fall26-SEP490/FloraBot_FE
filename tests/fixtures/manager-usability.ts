import type { Page } from '@playwright/test';
export const managerApplication = {
  id: 'app-operations',
  customerId: 'customer-1',
  packageId: 'package-1',
  packageName: 'Trial',
  annualFee: 10000,
  walkInSlots: 1,
  preorderSlots: 1,
  totalSlots: 2,
  shopName: 'Hoa Nhà Mình',
  phone: '0901234567',
  contactEmail: 'shop@example.test',
  installationAddress: '12 Nguyễn Huệ, TP. Hồ Chí Minh',
  latitude: 10.77,
  longitude: 106.7,
  bankName: 'MB',
  bankHolder: 'NGUYEN AN',
  bankAccountSuffix: '1234',
  status: 'SCHEDULED',
  assignedTechnicianId: 'tech-1',
  assignedTechnicianName: 'Minh Kỹ Thuật',
  assignedKioskId: 'kiosk-1',
  assignedKioskCode: 'K-HCM-01',
  scheduledDate: '2026-11-10T08:30:00Z',
  timeWindow: '10:00 - 12:00',
  createdAt: '2026-10-20T08:00:00Z',
  updatedAt: '2026-10-20T08:00:00Z',
  technicianReport: null,
};

export async function setupManagerUsability(page: Page) {
  const model = {
    role: 'OPERATIONS_MANAGER',
    failStatus: '',
    loadingStatus: '',
    requests: [] as string[],
    writes: [] as string[],
    apps: [
      {
        ...managerApplication,
        id: 'contact-1',
        status: 'PAID_REVIEW',
        shopName: 'Shop chờ liên hệ A',
      },
      {
        ...managerApplication,
        id: 'contact-2',
        status: 'PAID_REVIEW',
        shopName: 'Shop chờ liên hệ B',
      },
      {
        ...managerApplication,
        id: 'schedule-1',
        status: 'CONFIRMED',
        shopName: 'Shop chờ xếp lịch',
      },
      {
        ...managerApplication,
        id: 'handover-1',
        status: 'AWAITING_HANDOVER',
        shopName: 'Shop chờ bàn giao',
      },
    ],
  };
  await page.route('**/hub/**', (route) => route.fulfill({ status: 503 }));
  await page.route('**/api/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname.replace('/api', '');
    if (req.method() !== 'GET') {
      model.writes.push(path);
      return route.fulfill({ status: 405, json: { detail: 'Read only test' } });
    }
    model.requests.push(path + url.search);
    if (path === '/auth/me')
      return route.fulfill({
        json: { id: 'manager-test', name: 'Quản lý kiểm thử', role: model.role, sellerId: null },
      });
    if (path === '/operations/kiosk-applications') {
      const status = url.searchParams.get('status');
      const current = Number(url.searchParams.get('page') || 1);
      if (status && status === model.failStatus)
        return route.fulfill({ status: 503, json: { detail: 'Unavailable' } });
      const items = model.apps.filter((item) => !status || item.status === status);
      const size = status ? 1 : Number(url.searchParams.get('limit') || 10);
      return route.fulfill({
        json: {
          items: items.slice((current - 1) * size, current * size),
          page: current,
          hasMore: current * size < items.length,
        },
      });
    }
    if (path.startsWith('/operations/kiosk-applications/')) {
      const app =
        model.apps.find((item) => item.id === path.split('/').pop()) || managerApplication;
      return route.fulfill({ json: { application: app, evidencePhotos: [] } });
    }
    if (path === '/operations/technicians')
      return route.fulfill({
        json: [
          {
            id: 'tech-1',
            fullName: 'Minh Kỹ Thuật',
            name: 'Minh Kỹ Thuật',
            email: 'tech@example.test',
            phone: null,
            status: 'ACTIVE',
            role: 'TECHNICIAN',
            createdAt: '2026-10-20T08:00:00Z',
          },
        ],
      });
    if (path === '/operations/eligible-kiosks')
      return route.fulfill({
        json: [
          {
            id: 'kiosk-test',
            code: 'K-MANAGER-01',
            name: 'Tủ sẵn sàng phân bổ',
            status: 'OFFLINE',
            slotCount: 2,
          },
        ],
      });
    if (path === '/operations/staff') return route.fulfill({ json: [] });
    if (
      [
        '/operations/sellers',
        '/operations/customers',
        '/operations/incidents',
        '/operations/staff-tasks',
      ].includes(path)
    )
      return route.fulfill({ json: { items: [], page: 1, hasMore: false } });
    return route.fulfill({ status: 404, json: { detail: 'Unmocked read: ' + path } });
  });
  return model;
}
