import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Query } from '@tanstack/react-query';
import { portalRefreshCandidate } from '../apps/web/src/shared/lib/portal-refresh-policy';

function query(
  root: string,
  overrides: { active?: boolean; fetching?: boolean; age?: number } = {},
) {
  return {
    queryKey: [root],
    isActive: () => overrides.active ?? true,
    state: {
      fetchStatus: overrides.fetching ? 'fetching' : 'idle',
      dataUpdatedAt: Date.now() - (overrides.age ?? 60_000),
    },
  } as unknown as Query;
}
afterEach(() => vi.useRealTimers());
describe('Portal refresh scheduling', () => {
  it('excludes session and inactive caches and defers in-flight event refreshes', () => {
    for (const periodic of [false, true]) {
      expect(portalRefreshCandidate(query('session'), periodic)).toBe(false);
      expect(portalRefreshCandidate(query('web-orders', { active: false }), periodic)).toBe(false);
      expect(portalRefreshCandidate(query('web-orders', { fetching: true }), periodic)).toBe(
        !periodic,
      );
    }
  });
  it('refreshes catalog edits on events but does not poll catalog/reference data', () => {
    for (const root of [
      'products',
      'product-photos',
      'seller-accessories',
      'seller-overview-revenue',
      'dashboard-seller-staff',
    ]) {
      expect(portalRefreshCandidate(query(root))).toBe(true);
      expect(portalRefreshCandidate(query(root), true)).toBe(false);
    }
  });
  it('respects paused forms and avoids polling lists with their own timer twice', () => {
    const managed = query('staff-tasks');
    Object.assign(managed, { meta: { portalManagedRefresh: true, portalRefreshPaused: false } });
    expect(portalRefreshCandidate(managed, true)).toBe(false);
    expect(portalRefreshCandidate(managed)).toBe(true);
    Object.assign(managed, { meta: { portalManagedRefresh: true, portalRefreshPaused: true } });
    expect(portalRefreshCandidate(managed, true)).toBe(false);
    expect(portalRefreshCandidate(managed)).toBe(false);
  });
  it('retains fallback for operational queries without duplicating their own polling', () => {
    vi.useFakeTimers();
    vi.setSystemTime(100_000);
    for (const root of [
      'web-orders',
      'seller-kiosk-slots',
      'staff-tasks',
      'staff-chats',
      'admin-sellers',
    ]) {
      expect(portalRefreshCandidate(query(root), true)).toBe(true);
      expect(portalRefreshCandidate(query(root, { age: 4000 }), true)).toBe(false);
    }
  });
});
