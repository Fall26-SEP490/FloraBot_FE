import { describe, expect, it } from 'vitest';
import {
  canSendPreorderPickupOtp,
  matchesOrderFilter,
  needsOrderAction,
  orderClosed,
  orderNextStep,
  orderStage,
} from '../apps/web/src/features/orders/orders.utils';

describe('Order guidance follows backend state', () => {
  it('distinguishes a quote, confirmed money, stock readiness and physical completion', () => {
    const quote = { state: 'QUOTED', orderStatus: null, ready: false };
    const paid = { state: 'ORDERED', orderStatus: 'PAID', ready: false };
    const stocked = { ...paid, ready: true };
    expect([orderStage(quote), orderStage(paid), orderStage(stocked)]).toEqual([1, 2, 3]);
    expect(orderStage({ ...stocked, orderStatus: 'COMPLETED' })).toBe(4);
    expect(needsOrderAction(quote, 'member')).toBe(true);
    expect(needsOrderAction(paid, 'member')).toBe(false);
    expect(needsOrderAction(paid, 'seller')).toBe(true);
    expect(needsOrderAction(stocked, 'seller')).toBe(false);
    expect(orderNextStep(stocked, 'member')).toContain('chưa xác nhận cửa đã mở');
  });
  it('routes failures to operations instead of offering another device command', () => {
    const failed = { state: 'ORDERED', orderStatus: 'DISPENSE_FAILED', ready: false };
    expect(needsOrderAction(failed, 'admin')).toBe(true);
    expect(orderNextStep(failed, 'member')).toContain('Không tự gửi lại');
    expect(matchesOrderFilter(failed, 'ready', 'member')).toBe(false);
  });
  it.each(['CANCELLED', 'EXPIRED', 'REFUNDED', 'COMPLETED'])('treats %s as ended', (status) => {
    const row = { state: 'ORDERED', orderStatus: status, ready: false };
    expect(orderClosed(row)).toBe(true);
    expect(needsOrderAction(row, 'member')).toBe(false);
    expect(matchesOrderFilter(row, 'closed', 'admin')).toBe(true);
  });
  it('enforces Seller pickup OTP eligibility strictly', () => {
    const now = Date.parse('2026-10-31T10:00:00Z');
    const validRow = {
      kind: 'CUSTOM' as const,
      state: 'ORDERED',
      orderStatus: 'PAID',
      ready: true,
      pickupBefore: '2026-10-31T12:00:00Z',
    };
    expect(canSendPreorderPickupOtp(validRow, 'SELLER', now)).toBe(true);
    expect(canSendPreorderPickupOtp(validRow, 'SELLER_STAFF', now)).toBe(false);
    expect(canSendPreorderPickupOtp(validRow, 'CUSTOMER', now)).toBe(false);
    expect(canSendPreorderPickupOtp({ ...validRow, kind: 'STOCK' }, 'SELLER', now)).toBe(false);
    expect(canSendPreorderPickupOtp({ ...validRow, state: 'QUOTED' }, 'SELLER', now)).toBe(false);
    expect(
      canSendPreorderPickupOtp({ ...validRow, orderStatus: 'DISPENSING' }, 'SELLER', now),
    ).toBe(false);
    expect(canSendPreorderPickupOtp({ ...validRow, orderStatus: 'COMPLETED' }, 'SELLER', now)).toBe(
      false,
    );
    expect(canSendPreorderPickupOtp({ ...validRow, ready: false }, 'SELLER', now)).toBe(false);
    expect(
      canSendPreorderPickupOtp(
        { ...validRow, pickupBefore: '2026-10-31T09:59:59Z' },
        'SELLER',
        now,
      ),
    ).toBe(false);
  });
});
