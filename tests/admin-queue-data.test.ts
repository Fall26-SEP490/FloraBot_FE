import { describe, expect, it } from 'vitest';
import {
  adminQueues,
  queueCountLabel,
  readQueue,
} from '../apps/web/src/features/dashboard/admin-queues';

describe('Admin queue data stays scoped and truthful', () => {
  it('reads an unpaginated API list without inventing a total', () => {
    expect(readQueue([{ id: 'a' }, { id: 'b' }])).toEqual({ count: 2, hasMore: false });
  });
  it('marks a partial page without presenting it as a system total', () => {
    expect(queueCountLabel(readQueue({ items: [{ id: 'a' }], hasMore: true, total: 200 }))).toBe(
      '1+',
    );
  });
  it('distinguishes an empty valid list from malformed or missing data', () => {
    expect(readQueue({ items: [], hasMore: false })).toEqual({ count: 0, hasMore: false });
    for (const invalid of [null, undefined, { error: 'Unavailable' }, { items: null }]) {
      expect(() => readQueue(invalid)).toThrow();
    }
  });
  it('keeps all writes outside the dashboard and separates oversight', () => {
    expect(
      adminQueues.filter((queue) => queue.group === 'monitor').map((queue) => queue.key),
    ).toEqual(['incidents', 'installations']);
    expect(adminQueues.find((queue) => queue.key === 'installations')?.endpoint).toContain(
      'status=PAID_REVIEW',
    );
    expect(
      adminQueues
        .filter((queue) => queue.group === 'review')
        .every((queue) => queue.endpoint.startsWith('/admin/')),
    ).toBe(true);
  });
});
