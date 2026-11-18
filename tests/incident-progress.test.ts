import { describe, it, expect } from 'vitest';
import { incidentProgressLabel } from '../apps/web/src/features/incidents/incidents.utils';
describe('Incident progress from deployed BE', () => {
  it('distinguishes unassigned, assigned and waiting for review', () => {
    expect(incidentProgressLabel({ status: 'OPEN', progress: 'UNASSIGNED', task: null })).toBe(
      'Chưa phân công',
    );
    expect(
      incidentProgressLabel({
        status: 'OPEN',
        progress: 'IN_PROGRESS',
        task: { id: 'task', status: 'ASSIGNED', assigneeId: 'tech', assigneeName: 'KTV' },
      }),
    ).toBe('Đã phân công');
    expect(incidentProgressLabel({ status: 'OPEN', progress: 'AWAITING_REVIEW', task: null })).toBe(
      'Chờ nghiệm thu',
    );
  });
  it('does not claim the incident is closed just because its task completed', () => {
    expect(incidentProgressLabel({ status: 'OPEN', progress: 'COMPLETED', task: null })).toBe(
      'Việc đã xong · Phiếu chưa đóng',
    );
    expect(
      incidentProgressLabel({ status: 'RESOLVED_FIXED', progress: 'COMPLETED', task: null }),
    ).toBe('Đã giải quyết');
  });
});
