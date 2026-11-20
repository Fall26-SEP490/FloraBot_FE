import { describe, it, expect } from 'vitest';
import {
  incidentProgressLabel,
  incidentResolutionError,
} from '../apps/web/src/features/incidents/incidents.utils';
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

describe('repair rejection details from BE', () => {
  it('shows the actual missing condition instead of a generic version conflict', () => {
    for (const [code, message] of [
      ['REPAIR_SENSOR_STALE', 'Tín hiệu cảm biến chưa đủ mới.'],
      ['REPAIR_APPROVAL_REQUIRED', 'Seller chưa duyệt quyền sửa.'],
      ['REPAIR_SESSION_RECOVERY_REQUIRED', 'Phiên bảo trì cần phục hồi.'],
      ['TASK_VERSION_CONFLICT', 'Công việc đã đổi phiên bản.'],
    ])
      expect(incidentResolutionError({ status: 409, code, message }, true)).toBe(message);
  });
  it('keeps a cautious fallback for legacy undiagnosed slot conflicts', () => {
    expect(incidentResolutionError({ status: 409, message: 'Conflict' }, true)).toContain(
      'quyền sửa',
    );
    expect(incidentResolutionError({ status: 403, message: 'Không được phân công' }, true)).toBe(
      'Không được phân công',
    );
    expect(incidentResolutionError({ status: 409, message: 'Phiếu đã đóng' }, false)).toBe(
      'Phiếu đã đóng',
    );
  });
});
