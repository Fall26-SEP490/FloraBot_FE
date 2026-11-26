import { describe, expect, it, vi } from 'vitest';
import {
  matchesTaskSearch,
  newestFirst,
  readAllTaskPages,
} from '../apps/web/src/features/task-management/task-list.utils';

describe('assignment search across API pages', () => {
  it('puts the newest incident from a later API page on the first result page', async () => {
    const read = vi.fn(async (page: number) => ({
      items: Array.from({ length: 25 }, (_, index) => {
        const number = (page - 1) * 25 + index;
        return {
          id: `incident-${number}`,
          kioskName: 'Kiosk HCM 14',
          createdAt: new Date(Date.UTC(2026, 10, 1, 0, number)).toISOString(),
        };
      }),
      hasMore: page < 3,
    }));
    const result = await readAllTaskPages(read);
    const matches = newestFirst(result.items).filter((item) =>
      matchesTaskSearch([item.kioskName], 'hcm 14'),
    );
    expect(matches).toHaveLength(75);
    expect(matches.slice(0, 10)[0].id).toBe('incident-74');
    expect(read.mock.calls.map(([page]) => page)).toEqual([1, 2, 3]);
  });
  it('matches Vietnamese and separate terms without joining field boundaries', () => {
    expect(matchesTaskSearch(['Kiosk HCM 14', 'Lợi Technical', 'Đang thực hiện'], 'loi 14')).toBe(
      true,
    );
    expect(matchesTaskSearch(['SC-792F43', 'Ô S01'], 'sc 792f43')).toBe(true);
    expect(matchesTaskSearch(['abc', 'def'], 'bcde')).toBe(false);
  });
  it('sorts review reports by update time rather than assignment time', () => {
    const rows = [
      { id: 'old-task-new-report', createdAt: '2026-11-01', updatedAt: '2026-11-26' },
      { id: 'new-task-old-report', createdAt: '2026-11-25', updatedAt: '2026-11-25' },
    ];
    expect(newestFirst(rows)[0].id).toBe('new-task-old-report');
    expect(newestFirst(rows, true)[0].id).toBe('old-task-new-report');
  });
  it('rejects partial results when a later API page fails', async () => {
    await expect(
      readAllTaskPages(async (page) => {
        if (page === 2) throw new Error('HTTP 503');
        return { items: [{ id: 'one' }], hasMore: true };
      }),
    ).rejects.toThrow('HTTP 503');
  });
  it('deduplicates overlapping pages and stops a non-progressing API', async () => {
    const result = await readAllTaskPages(async (page) => ({
      items: page === 1 ? [{ id: 'a' }] : [{ id: 'a' }, { id: 'b' }],
      hasMore: page === 1,
    }));
    expect(result.items.map((row) => row.id)).toEqual(['a', 'b']);
    await expect(
      readAllTaskPages(async () => ({ items: [{ id: 'same' }], hasMore: true })),
    ).rejects.toThrow();
  });
});
