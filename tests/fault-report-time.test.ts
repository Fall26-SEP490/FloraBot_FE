import { describe, expect, it } from 'vitest';
import { faultReportWait } from '../apps/web/src/features/incidents/incidents.utils';

describe('fault report waiting time', () => {
  const sent = '2026-11-26T03:00:00Z';
  it('uses the persisted instant and handles day boundaries', () => {
    expect(faultReportWait(sent, Date.parse('2026-11-27T04:02:00Z'))).toBe(
      'Đã chờ 1 ngày 1 giờ 2 phút',
    );
    expect(faultReportWait('2026-11-26T10:00:00+07:00', Date.parse('2026-11-26T03:05:00Z'))).toBe(
      'Đã chờ 5 phút',
    );
  });
  it('does not show a negative duration or an invalid timestamp', () => {
    expect(faultReportWait(sent, Date.parse(sent) - 60_000)).toBe('Vừa gửi');
    expect(faultReportWait('invalid', Date.now())).toBeNull();
  });
});
