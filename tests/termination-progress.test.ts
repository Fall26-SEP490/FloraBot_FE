import { describe, expect, it } from 'vitest';
import { terminationNextStep } from '../apps/web/src/features/kiosk-management/termination-progress';

describe('Termination guidance keeps handover and archive distinct', () => {
  it('does not tell Manager to archive when the technician has only submitted a report', () => {
    const step = terminationNextStep({
      status: 'ACCEPTED',
      removalTaskStatus: 'SUBMITTED',
      archived: false,
    });
    expect(step.owner).toBe('Manager');
    expect(step.action).toBe('Nghiệm thu bàn giao');
  });
  it('handover complete still requires archive; OFFLINE alone does not mean archived', () => {
    const step = terminationNextStep({
      status: 'COMPLETED',
      kioskStatus: 'OFFLINE',
      archived: false,
    });
    expect(step.owner).toBe('Manager');
    expect(step.attention).toBe(true);
    expect(step.action).toBe('Kiểm tra lưu trữ');
  });
  it('requires offline before archive and never claims an online kiosk is archived', () => {
    const step = terminationNextStep({
      status: 'COMPLETED',
      kioskStatus: 'ONLINE',
      archived: false,
    });
    expect(step.text).toContain('OFFLINE');
    expect(step.owner).toBe('Manager');
  });
  it('assigned and running dismantling belong to the technician until a report arrives', () => {
    for (const status of ['ASSIGNED', 'IN_PROGRESS']) {
      const step = terminationNextStep({
        status: 'ACCEPTED',
        removalTaskStatus: status,
        archived: false,
      });
      expect(step.owner).toBe('Kỹ thuật viên');
      expect(step.attention).toBe(false);
    }
  });
  it('an archived kiosk is history rather than another actionable archive request', () => {
    const step = terminationNextStep({
      status: 'COMPLETED',
      archived: true,
      kioskStatus: 'DISABLED',
    });
    expect(step.attention).toBe(false);
    expect(step.action).toBe('Xem hồ sơ');
    expect(step.owner).toBe('Hoàn tất');
  });
  it('a cancelled removal task requires assignment again, a withdrawn request does not', () => {
    expect(
      terminationNextStep({ status: 'ACCEPTED', removalTaskStatus: 'CANCELLED', archived: false })
        .action,
    ).toBe('Phân công tháo dỡ');
    expect(terminationNextStep({ status: 'CANCELLED', archived: false }).attention).toBe(false);
  });
});
