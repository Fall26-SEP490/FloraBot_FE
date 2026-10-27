import { describe, expect, it } from 'vitest';
import {
  validatePayosCheckoutUrl,
  parseAndValidateCoordinate,
} from '../apps/web/src/features/installations/installations.utils';
import {
  KIOSK_PACKAGE_DEFAULTS,
  KIOSK_STATUS_LABELS,
} from '../apps/web/src/features/installations/installations.constants';

describe('Annual Kiosk Onboarding Unit Tests', () => {
  describe('validatePayosCheckoutUrl (fail-closed security validation)', () => {
    it('accepts exact https://pay.payos.vn URLs with default port', () => {
      const res = validatePayosCheckoutUrl('https://pay.payos.vn/web/order12345');
      expect(res.valid).toBe(true);
      expect(res.url).toBe('https://pay.payos.vn/web/order12345');
    });

    it('rejects evil suffix domains like evilpayos.vn', () => {
      const res = validatePayosCheckoutUrl('https://evilpayos.vn/web/12345');
      expect(res.valid).toBe(false);
      expect(res.error).toContain('yêu cầu pay.payos.vn');
    });

    it('rejects subdomains like sub.payos.vn or api.payos.vn', () => {
      const res = validatePayosCheckoutUrl('https://fake.payos.vn/checkout');
      expect(res.valid).toBe(false);
      expect(res.error).toContain('yêu cầu pay.payos.vn');
    });

    it('rejects insecure HTTP protocol', () => {
      const res = validatePayosCheckoutUrl('http://pay.payos.vn/web/12345');
      expect(res.valid).toBe(false);
      expect(res.error).toContain('HTTPS');
    });

    it('rejects non-default ports on pay.payos.vn', () => {
      const res = validatePayosCheckoutUrl('https://pay.payos.vn:8443/web/12345');
      expect(res.valid).toBe(false);
      expect(res.error).toContain('Cổng kết nối không tiêu chuẩn');
    });

    it('rejects userinfo in payment URL', () => {
      const res = validatePayosCheckoutUrl('https://admin:password@pay.payos.vn/web/12345');
      expect(res.valid).toBe(false);
      expect(res.error).toContain('thông tin xác thực');
    });

    it('rejects javascript: schemes', () => {
      const res = validatePayosCheckoutUrl('javascript:alert(1)');
      expect(res.valid).toBe(false);
    });

    it('rejects empty, null, and blank inputs', () => {
      expect(validatePayosCheckoutUrl('').valid).toBe(false);
      expect(validatePayosCheckoutUrl('   ').valid).toBe(false);
      expect(validatePayosCheckoutUrl(null as unknown as string).valid).toBe(false);
    });

    it('rejects localhost checkout targets even when the app runs locally', () => {
      expect(validatePayosCheckoutUrl('http://localhost:3010/checkout').valid).toBe(false);
      expect(validatePayosCheckoutUrl('https://127.0.0.1/checkout').valid).toBe(false);
    });
  });

  describe('parseAndValidateCoordinate (Blank != 0 & Strict range validation)', () => {
    it('accepts 0 as a mathematically valid coordinate', () => {
      const latRes = parseAndValidateCoordinate('0', 'lat');
      expect(latRes.valid).toBe(true);
      expect(latRes.value).toBe(0);

      const lonRes = parseAndValidateCoordinate('0', 'lon');
      expect(lonRes.valid).toBe(true);
      expect(lonRes.value).toBe(0);
    });

    it('rejects blank / empty strings (blank != 0)', () => {
      const emptyRes = parseAndValidateCoordinate('', 'lat');
      expect(emptyRes.valid).toBe(false);
      expect(emptyRes.value).toBe(null);
      expect(emptyRes.error).toContain('ô trống không đồng nghĩa với 0');

      const whitespaceRes = parseAndValidateCoordinate('   ', 'lon');
      expect(whitespaceRes.valid).toBe(false);
      expect(whitespaceRes.value).toBe(null);
    });

    it('rejects non-numeric NaN inputs', () => {
      const nanRes = parseAndValidateCoordinate('abc', 'lat');
      expect(nanRes.valid).toBe(false);
      expect(nanRes.value).toBe(null);
      expect(nanRes.error).toContain('phải là một số hợp lệ');
    });

    it('validates latitude within -90 to 90', () => {
      expect(parseAndValidateCoordinate('10.776889', 'lat').valid).toBe(true);
      expect(parseAndValidateCoordinate('-89.9', 'lat').valid).toBe(true);
      expect(parseAndValidateCoordinate('90', 'lat').valid).toBe(true);
      expect(parseAndValidateCoordinate('-90', 'lat').valid).toBe(true);

      // Out of range
      const high = parseAndValidateCoordinate('90.0001', 'lat');
      expect(high.valid).toBe(false);
      expect(high.error).toContain('-90 đến 90');

      const low = parseAndValidateCoordinate('-91', 'lat');
      expect(low.valid).toBe(false);
      expect(low.error).toContain('-90 đến 90');
    });

    it('validates longitude within -180 to 180', () => {
      expect(parseAndValidateCoordinate('106.700806', 'lon').valid).toBe(true);
      expect(parseAndValidateCoordinate('-179.9', 'lon').valid).toBe(true);
      expect(parseAndValidateCoordinate('180', 'lon').valid).toBe(true);
      expect(parseAndValidateCoordinate('-180', 'lon').valid).toBe(true);

      // Out of range
      const high = parseAndValidateCoordinate('180.1', 'lon');
      expect(high.valid).toBe(false);
      expect(high.error).toContain('-180 đến 180');

      const low = parseAndValidateCoordinate('-185', 'lon');
      expect(low.valid).toBe(false);
      expect(low.error).toContain('-180 đến 180');
    });
  });

  describe('Package Catalog & Capacities Integrity', () => {
    it('defines exact Trial (1W+1P=2), Pro (4W+4P=8), Max (6W+6P=12) 1-year packages', () => {
      const [trial, pro, max] = KIOSK_PACKAGE_DEFAULTS;

      expect(trial.name).toBe('Trial');
      expect(trial.annualFee).toBe(10000);
      expect(trial.walkInSlots).toBe(1);
      expect(trial.preorderSlots).toBe(1);
      expect(trial.totalSlots).toBe(2);
      expect(trial.termMonths).toBe(12);

      expect(pro.name).toBe('Pro');
      expect(pro.annualFee).toBe(15000);
      expect(pro.walkInSlots).toBe(4);
      expect(pro.preorderSlots).toBe(4);
      expect(pro.totalSlots).toBe(8);
      expect(pro.termMonths).toBe(12);

      expect(max.name).toBe('Max');
      expect(max.annualFee).toBe(20000);
      expect(max.walkInSlots).toBe(6);
      expect(max.preorderSlots).toBe(6);
      expect(max.totalSlots).toBe(12);
      expect(max.termMonths).toBe(12);
    });

    it('contains friendly Vietnamese labels for all lifecycle statuses', () => {
      expect(KIOSK_STATUS_LABELS.AWAITING_PAYMENT).toBe('Chờ thanh toán phí thuê');
      expect(KIOSK_STATUS_LABELS.PAID_REVIEW).toBe('Đã thanh toán - Chờ duyệt');
      expect(KIOSK_STATUS_LABELS.CONFIRMED).toBe('Đã xác nhận - Chờ xếp lịch');
      expect(KIOSK_STATUS_LABELS.SCHEDULED).toBe('Đã xếp lịch lắp đặt');
      expect(KIOSK_STATUS_LABELS.INSTALLING).toBe('Đang lắp đặt tại điểm');
      expect(KIOSK_STATUS_LABELS.AWAITING_HANDOVER).toBe('Chờ nghiệm thu bàn giao');
      expect(KIOSK_STATUS_LABELS.ACTIVE).toBe('Đang hoạt động (Chủ shop)');
      expect(KIOSK_STATUS_LABELS.REFUND_PENDING).toBe('Đang xử lý hoàn tiền');
      expect(KIOSK_STATUS_LABELS.REFUNDED).toBe('Đã hoàn tiền');
    });
  });
});
