import { describe, expect, it } from 'vitest';
import {
  matchesOrderFilter,
  needsOrderAction,
  orderClosed,
  orderNextStep,
  orderStage,
} from '../apps/web/src/orderWorkflow';

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
});
