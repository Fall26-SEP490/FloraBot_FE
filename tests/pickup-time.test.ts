import { describe, expect, it } from 'vitest';
import { pickupTimeAllowed } from '../apps/web/src/features/catalog/pickup-time';

describe('Vietnam pickup time choices', () => {
  const now = Date.parse('2026-11-26T14:25:00+07:00');
  it('blocks elapsed hours and accepts the next half hour without adding lead time', () => {
    expect(pickupTimeAllowed('2026-11-26', '14:00', now)).toBe(false);
    expect(pickupTimeAllowed('2026-11-26', '14:30', now)).toBe(true);
    expect(pickupTimeAllowed('2026-11-26', '02:00', now)).toBe(false);
  });
  it('allows early hours on future days and enforces the 30-day window', () => {
    expect(pickupTimeAllowed('2026-11-27', '00:00', now)).toBe(true);
    expect(pickupTimeAllowed('2026-12-26', '14:00', now)).toBe(true);
    expect(pickupTimeAllowed('2026-12-26', '14:30', now)).toBe(false);
  });
  it('uses Vietnam time even across UTC midnight and when the clock moves', () => {
    expect(pickupTimeAllowed('2026-11-27', '00:00', Date.parse('2026-11-26T16:59:00Z'))).toBe(true);
    expect(pickupTimeAllowed('2026-11-27', '00:00', Date.parse('2026-11-26T17:00:00Z'))).toBe(
      false,
    );
    expect(pickupTimeAllowed('', '14:30', now)).toBe(false);
  });
});
