import { describe, expect, it } from 'vitest';
import { clampPage, paginate, pageRange, totalPages } from '../apps/web/src/shared/pagination';

describe('dashboard table pagination', () => {
  it('calculates pages and slices a complete last page', () => {
    expect(totalPages(8, 4)).toBe(2);
    expect(paginate([1, 2, 3, 4, 5, 6, 7, 8], 2, 4)).toEqual([5, 6, 7, 8]);
    expect(pageRange(2, 8, 4)).toEqual({ start: 4, end: 8 });
  });

  it('clamps pages after rows are removed or added', () => {
    expect(clampPage(5, 6, 4)).toBe(2);
    expect(clampPage(0, 6, 4)).toBe(1);
    expect(clampPage(2, 0, 4)).toBe(1);
  });

  it('handles an empty table without a fake range', () => {
    expect(totalPages(0, 4)).toBe(1);
    expect(pageRange(1, 0, 4)).toEqual({ start: 0, end: 0 });
    expect(paginate([], 1, 4)).toEqual([]);
  });

  it('rejects invalid page sizes', () => {
    expect(() => totalPages(3, 0)).toThrow('pageSize must be greater than zero');
  });
});
