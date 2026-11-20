import { describe, expect, it } from 'vitest';
import {
  displayVietnamDate,
  vietnamDate,
  vietnamDateTime,
  vietnamDateTimeToUtc,
} from '../apps/web/src/shared/lib/vietnam-date';

describe('Vietnamese calendar dates', () => {
  it('formats using UTC+7 at midnight and sends the selected wall time as UTC', () => {
    expect(vietnamDate('2026-11-19T18:30:00Z')).toBe('2026-11-20');
    expect(vietnamDateTime('2026-11-19T18:30:00Z')).toBe('2026-11-20T01:30');
    expect(vietnamDateTimeToUtc('2026-11-20T01:30')).toBe('2026-11-19T18:30:00.000Z');
    expect(displayVietnamDate('2026-11-20T21:05', true)).toBe('20/11/2026 21:05');
    expect(displayVietnamDate('2026-11', false, true)).toBe('11/2026');
  });
  it('rejects invalid dates and accepts leap days', () => {
    expect(() => vietnamDateTimeToUtc('2026-02-29T12:00')).toThrow();
    expect(() => vietnamDateTimeToUtc('2026-11-20T25:00')).toThrow();
    expect(vietnamDateTimeToUtc('2024-02-29T00:00')).toBe('2024-02-28T17:00:00.000Z');
  });
});
