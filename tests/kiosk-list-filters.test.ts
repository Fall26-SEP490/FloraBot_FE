import { describe, expect, it } from 'vitest';
import { kioskOptions, matchesKiosk } from '../apps/web/src/shared/lib/kiosk-filter';
import {
  matchesTaskSearch,
  newestFirst,
  readAllTaskPages,
} from '../apps/web/src/features/task-management/task-list.utils';

describe('portal kiosk filters', () => {
  it('keeps kiosks with the same name distinct by API ID and removes duplicate options', () => {
    const options = kioskOptions([
      { id: 'k14', name: 'Kiosk HCM', code: 'K-HCM-14' },
      { id: 'k12', name: 'Kiosk HCM', code: 'K-HCM-12' },
      { id: 'k14', name: 'Kiosk HCM', code: 'K-HCM-14' },
    ]);
    expect(options.map((row) => row.id)).toEqual(['k12', 'k14']);
    expect(matchesKiosk('k12', 'k14')).toBe(false);
    expect(matchesKiosk('k14', 'k14')).toBe(true);
    expect(matchesKiosk('k12', '')).toBe(true);
    expect(matchesKiosk(undefined, 'k14')).toBe(false);
  });

  it('combines kiosk, status and accent-insensitive search before paginating every API page', async () => {
    const all = await readAllTaskPages(async (page) => ({
      items: Array.from({ length: 25 }, (_, index) => {
        const number = (page - 1) * 25 + index;
        return {
          id: String(number),
          kioskId: number < 25 ? 'k12' : 'k14',
          status: number % 2 === 0 ? 'IN_PROGRESS' : 'SUBMITTED',
          name: 'Lợi Technical',
          createdAt: new Date(Date.UTC(2026, 10, 1, 0, number)).toISOString(),
        };
      }),
      hasMore: page === 1,
    }));
    const rows = newestFirst(all.items).filter(
      (row) =>
        matchesKiosk(row.kioskId, 'k14') &&
        row.status === 'IN_PROGRESS' &&
        matchesTaskSearch([row.name], 'loi'),
    );
    expect(rows).toHaveLength(12);
    expect(rows.slice(0, 10)[0].id).toBe('48');
    expect(rows.every((row) => row.kioskId === 'k14')).toBe(true);
    expect(rows.slice(10)).toHaveLength(2);
    expect(
      newestFirst(all.items).filter(
        (row) => matchesKiosk(row.kioskId, 'k14') && matchesTaskSearch([row.name], 'missing'),
      ),
    ).toEqual([]);
  });
});
