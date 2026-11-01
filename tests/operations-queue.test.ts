import { describe, expect, it } from 'vitest';
import { readOperationsCount } from '../apps/web/src/features/dashboard/operations-queue';
import {
  managerApplicationAction,
  validApplicationStatus,
} from '../apps/web/src/features/installations/operations-presentation';
describe('Operations workbench', () => {
  it('counts across hasMore without double counting repeated records', async () => {
    const result = await readOperationsCount(async (page) => ({
      items: page === 1 ? [{ id: 'a' }] : [{ id: 'a' }, { id: 'b' }],
      hasMore: page === 1,
    }));
    expect(result).toEqual({ count: 2, hasMore: false });
  });
  it('marks bounded counts partial instead of a total', async () => {
    expect(
      await readOperationsCount(
        async (page) => ({ items: [{ id: String(page) }], hasMore: true }),
        undefined,
        2,
      ),
    ).toEqual({ count: 2, hasMore: true });
  });
  it('rejects broken pagination and failure on later pages', async () => {
    await expect(readOperationsCount(async () => ({ items: [], hasMore: true }))).rejects.toThrow();
    await expect(
      readOperationsCount(async (page) => {
        if (page === 2) throw new Error('Page failed');
        return { items: [{ id: 'a' }], hasMore: true };
      }),
    ).rejects.toThrow('Page failed');
  });
  it('only accepts supported status filters and uses correct action labels', () => {
    expect(validApplicationStatus('PAID_REVIEW')).toBe('PAID_REVIEW');
    expect(validApplicationStatus('something-else')).toBe('ALL');
    expect(managerApplicationAction('CONFIRMED')).toBe('Xếp lịch');
    expect(managerApplicationAction('AWAITING_HANDOVER')).toBe('Kiểm tra bàn giao');
    expect(managerApplicationAction('ACTIVE')).toBe('Chi tiết');
  });
});
