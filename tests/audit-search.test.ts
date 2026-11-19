import { describe, expect, it, vi } from 'vitest';
import {
  loadAuditPages,
  matchesAuditSearch,
} from '../apps/web/src/features/dashboard/audit-search.utils';

describe('Audit search phrases', () => {
  it('does not match o tu against separate fragments in an order record', () => {
    expect(
      matchesAuditSearch(
        ['ORDER_STATUS_CHANGED', 'Đổi trạng thái đơn hàng', 'orders', 'Đơn hàng', 'Tài khoản'],
        'o tu',
      ),
    ).toBe(false);
  });
  it('matches the full slot phrase with or without accents and extra whitespace', () => {
    for (const query of ['ô tủ', 'o tu', '  O   TU  ']) {
      expect(
        matchesAuditSearch(['SLOT_MAINTENANCE_COMPLETED', 'Kết thúc bảo trì ô tủ', 'Ô tủ'], query),
      ).toBe(true);
    }
  });
  it('keeps partial ID and original event code lookup', () => {
    expect(matchesAuditSearch(['DEVICE_OPENED', '01a1-abcd-9999'], 'abcd')).toBe(true);
    expect(matchesAuditSearch(['DEVICE_OPENED', 'Cửa đã mở'], 'device_open')).toBe(true);
  });
  it('does not join words across unrelated columns and accepts an empty search', () => {
    expect(matchesAuditSearch(['đơn hàng', 'tủ'], 'hang tu')).toBe(false);
    expect(matchesAuditSearch(['Đơn hàng'], ' ')).toBe(true);
  });
});

describe('Search across audit API pages', () => {
  it('finds results on later pages and paginates the matching result from page one', async () => {
    const fetchPage = vi.fn(async (page: number) => ({
      items: Array.from({ length: 50 }, (_, i) => ({
        id: (page - 1) * 50 + i,
        entity: page === 1 ? 'Đơn hàng' : 'Ô tủ',
      })),
      hasMore: page < 3,
    }));
    const all = await loadAuditPages(fetchPage);
    const matches = all.filter((item) => matchesAuditSearch([item.entity], 'o tu'));
    expect(fetchPage).toHaveBeenCalledTimes(3);
    expect(matches).toHaveLength(100);
    expect(matches.slice(0, 10).map((item) => item.id)).toEqual([
      50, 51, 52, 53, 54, 55, 56, 57, 58, 59,
    ]);
    expect(matches.slice(10, 20)[0].id).toBe(60);
  });
  it('does not expose partial results when a later API page fails', async () => {
    await expect(
      loadAuditPages(async (page) => {
        if (page === 2) throw new Error('network');
        return { items: [{ id: 1 }], hasMore: true };
      }),
    ).rejects.toThrow('network');
  });
  it('stops a cancelled search and deduplicates overlapping pages', async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchPage = vi.fn();
    await expect(loadAuditPages(fetchPage, controller.signal)).rejects.toThrow();
    expect(fetchPage).not.toHaveBeenCalled();
    expect(
      await loadAuditPages(async (page) => ({
        items: [{ id: page === 1 ? 1 : 1 }],
        hasMore: page < 2,
      })),
    ).toEqual([{ id: 1 }]);
  });
});
