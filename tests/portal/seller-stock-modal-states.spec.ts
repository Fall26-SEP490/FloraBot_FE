import { test, expect } from '@playwright/test';
import {
  setupSellerUsability,
  kioskId,
  productId,
  sampleProduct,
} from '../fixtures/seller-usability';

const cases = [
  'offline',
  'stocked',
  'held',
  'sold',
  'fault',
  'preorder',
  'unready',
  'loading',
  'inspection',
  'completed',
  'conflict',
  'sync-slot-first',
  'sync-session-first',
] as const;
for (const state of cases) {
  test(`Stock modal state ${state}`, async ({ page }) => {
    await setupSellerUsability(page);
    await page.setViewportSize({
      width: state === 'offline' || state === 'inspection' ? 390 : 1440,
      height: 960,
    });
    let writes = 0;
    let synced = false;
    const session = [
      'loading',
      'inspection',
      'completed',
      'sync-slot-first',
      'sync-session-first',
    ].includes(state)
      ? {
          id: 'session-1',
          kioskId,
          slotId: 'slot-state',
          action: 'REPLACE',
          stage:
            state === 'inspection'
              ? 'NeedsInspection'
              : state === 'completed' || state === 'sync-session-first'
                ? 'Completed'
                : 'AwaitLoading',
          substate: state === 'loading' ? 'RemovalClosedEmptyConfirmed' : null,
          currentCmdId: null,
          expiresAt: new Date(Date.now() + 600000).toISOString(),
          inspectionReason: 'SensorMismatch',
          availableActions:
            state === 'loading' ? ['open-next'] : state === 'inspection' ? ['report-issue'] : [],
          retryAfterSeconds: 0,
        }
      : null;
    const slot = {
      id: 'slot-state',
      kioskId,
      slotCode: 'S01',
      zone: state === 'preorder' ? 'PREORDER' : 'WALK_IN',
      status:
        state === 'held'
          ? 'HELD'
          : state === 'fault'
            ? 'FAULT'
            : state === 'completed' || state === 'sync-slot-first'
              ? 'STOCKED'
              : session
                ? 'LOCKED'
                : state === 'preorder'
                  ? 'RENTED_EMPTY'
                  : 'STOCKED',
      bouquetId: state === 'preorder' ? null : 'bouquet-1',
      productId,
      qrCode: 'FB-01a1fc6dd9df7033983603129c66e199',
      priceSnapshot: 10000,
      sellableUntil: '9999-01-01',
      sensorEnabled: true,
      sensorReady: state !== 'unready',
      orderId: state === 'sold' || state === 'held' ? 'order-1' : null,
      orderStatus: state === 'sold' ? 'PAID' : state === 'held' ? 'AWAITING_PAYMENT' : null,
      bouquetStatus: state === 'sold' ? 'SOLD' : 'STOCKED',
      paymentStatus: state === 'sold' ? 'SUCCEEDED' : null,
      maintenanceStage: session?.stage,
    };
    await page.route('**/api/**', async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (route.request().method() !== 'GET') {
        writes++;
        return route.fulfill({
          status: 409,
          json: { detail: 'Kiosk hiện đang không trực tuyến.' },
        });
      }
      if (path.endsWith('/kiosks'))
        return route.fulfill({
          json: [
            {
              id: kioskId,
              code: 'K01',
              name: 'Kiosk kiểm thử',
              status: state === 'offline' ? 'OFFLINE' : 'ONLINE',
            },
          ],
        });
      if (path.endsWith('/slots'))
        return route.fulfill({
          json: [synced ? { ...slot, status: 'STOCKED', maintenanceStage: 'Completed' } : slot],
        });
      if (path.endsWith('/products'))
        return route.fulfill({ json: [{ ...sampleProduct, quantity: 3 }] });
      if (path.endsWith('/maintenance-sessions/active'))
        return session ? route.fulfill({ json: session }) : route.fulfill({ status: 204 });
      if (path.endsWith('/maintenance-sessions/session-1'))
        return route.fulfill({ json: synced ? { ...session, stage: 'Completed' } : session });
      return route.fallback();
    });
    await page.goto('/seller/stock');
    await page.getByRole('button', { name: 'Xem chi tiết ô S01' }).click();
    const dialog = page.getByRole('dialog', { name: /ô S01/ });
    await expect(dialog).toBeVisible();
    expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    if (state === 'sync-slot-first' || state === 'sync-session-first') {
      await expect(dialog.locator('.stock-maintenance-state')).toContainText('Đang đồng bộ ô tủ');
      await expect(dialog.locator('.stock-maintenance-progress')).not.toContainText(
        'Đang chờ nạp hoa',
      );
      synced = true;
      await expect(dialog.locator('.stock-maintenance-state')).toContainText('Đã hoàn tất', {
        timeout: 15_000,
      });
      await expect(dialog.locator('.stock-slot-modal-status')).toContainText('Đang bán');
    } else if (['offline', 'stocked', 'conflict'].includes(state)) {
      await dialog.getByLabel('Lý do thao tác').fill('Kiểm tra thu hồi hoa');
      const start = dialog.getByRole('button', { name: 'Bắt đầu thu hồi hoa' });
      if (state === 'offline') {
        await expect(start).toBeDisabled();
        await expect(dialog.getByRole('alert')).toContainText('Kiosk chưa trực tuyến');
      } else await expect(start).toBeEnabled();
      if (state === 'conflict') {
        await start.click();
        await expect(dialog.getByRole('alert')).toContainText('Kiosk hiện đang không trực tuyến.');
        await expect(dialog).not.toContainText('HTTP 409');
      }
    } else if (state === 'loading')
      await expect(dialog.getByRole('button', { name: 'Mở cửa nạp hoa mới' })).toBeVisible();
    else if (state === 'inspection') {
      await expect(dialog).toContainText('Chưa thể xác nhận kết quả');
      await expect(dialog.locator('.stock-maintenance-progress')).toHaveCSS(
        'color',
        'rgb(176, 46, 46)',
      );
    } else if (state === 'completed')
      await expect(dialog.getByRole('button', { name: 'Đóng tiến độ' })).toBeVisible();
    else await expect(dialog.getByRole('button', { name: 'Bắt đầu thu hồi hoa' })).toHaveCount(0);
    expect(writes).toBe(state === 'conflict' ? 1 : 0);
  });
}
