import { describe, expect, it } from 'vitest';
import {
  slotNeedsAttention,
  slotSaleState,
  slotWarning,
} from '../apps/web/src/features/inventory/slot-state';

const stocked = {
  status: 'STOCKED',
  bouquetId: 'bouquet',
  bouquetStatus: 'STOCKED',
  orderId: null,
  orderCode: null,
  orderStatus: null,
  paymentStatus: null,
};
const paid = {
  ...stocked,
  status: 'HELD',
  bouquetStatus: 'SOLD',
  orderId: 'order',
  orderStatus: 'PAID',
  paymentStatus: 'SUCCEEDED',
};

describe('Seller slot sale state from bouquet, order and payment', () => {
  it.each([
    [stocked, 'Đang bán'],
    [
      {
        ...stocked,
        status: 'HELD',
        bouquetStatus: 'HELD',
        orderId: 'order',
        orderStatus: 'AWAITING_PAYMENT',
        paymentStatus: 'PENDING',
      },
      'Khách đang thanh toán',
    ],
    [paid, 'Đã bán — chờ khách nhận'],
    [{ ...paid, orderStatus: 'DISPENSING' }, 'Đã bán — đang xử lý nhận hoa'],
    [{ ...stocked, status: 'RENTED_EMPTY', bouquetId: null, bouquetStatus: null }, 'Ô trống'],
    [{ ...paid, orderStatus: 'DISPENSE_FAILED' }, 'Nhận hoa thất bại — cần xử lý'],
  ])('shows %j as %s', (slot, label) => {
    expect(slotSaleState(slot).label).toBe(label);
  });

  it.each(['FAULT', 'LOCKED', 'PENDING_REMOVAL'])(
    'preserves %s alongside the sale state',
    (status) => {
      const slot = { ...paid, status };
      expect(slotSaleState(slot).label).toBe('Đã bán — chờ khách nhận');
      expect(slotWarning(slot)).toBeTruthy();
      expect(slotNeedsAttention(slot)).toBe(true);
    },
  );

  it('does not treat every held slot as an ongoing payment', () => {
    expect(slotSaleState({ status: 'HELD', bouquetId: 'bouquet' }).label).toBe('Ô đang được giữ');
    expect(slotSaleState({ ...paid, paymentStatus: 'PENDING' }).label).not.toBe(
      'Khách đang thanh toán',
    );
  });

  it('does not advertise stock linked to an order as available for sale', () => {
    expect(slotSaleState({ ...stocked, orderId: 'order' }).label).not.toBe('Đang bán');
    expect(slotSaleState({ ...stocked, orderCode: 'FB-1' }).label).not.toBe('Đang bán');
  });

  it('does not call a slot containing a bouquet empty', () => {
    expect(slotSaleState({ ...stocked, status: 'RENTED_EMPTY' }).label).not.toBe('Ô trống');
  });

  it('keeps failed pickups in the attention filter even without a held slot', () => {
    expect(slotNeedsAttention({ ...paid, status: 'STOCKED', orderStatus: 'DISPENSE_FAILED' })).toBe(
      true,
    );
  });
});
