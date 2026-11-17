import { describe, expect, it } from 'vitest';
import {
  installationReportDraftKey,
  readInstallationReportDraft,
  saveInstallationReportDraft,
} from '../apps/web/src/features/installations/installation-report-draft';
import { requiresOutcomeCheck } from '../apps/web/src/shared/lib/mutation-outcome';
import { ApiError } from '../apps/web/src/shared/lib/api';

function draftStore() {
  const entries = new Map<string, string>();
  return {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => {
      entries.set(key, value);
    },
    removeItem: (key: string) => {
      entries.delete(key);
    },
  };
}

describe('installation report drafts', () => {
  it('restores Vietnamese multiline text without submitting or trimming it', () => {
    const storage = draftStore();
    const key = installationReportDraftKey('tech-1', 'job-1');
    const report = 'Đã kiểm tra ô S01.\nCần bổ sung ảnh khóa.  ';
    expect(saveInstallationReportDraft(key, report, storage)).toBe(true);
    expect(readInstallationReportDraft(key, storage)).toBe(report);
  });
  it('separates jobs and signed-in technicians, including IDs containing separators', () => {
    const storage = draftStore();
    const key = installationReportDraftKey('a:b', 'c');
    saveInstallationReportDraft(key, 'Báo cáo của kỹ thuật viên A', storage);
    expect(readInstallationReportDraft(installationReportDraftKey('a', 'b:c'), storage)).toBe('');
    expect(
      readInstallationReportDraft(installationReportDraftKey('a:b', 'other-job'), storage),
    ).toBe('');
  });
  it('clears only the completed report and retains drafts for other jobs', () => {
    const storage = draftStore();
    const first = installationReportDraftKey('tech-1', 'job-1');
    const second = installationReportDraftKey('tech-1', 'job-2');
    saveInstallationReportDraft(first, 'Đã lắp đặt', storage);
    saveInstallationReportDraft(second, 'Đang soạn', storage);
    saveInstallationReportDraft(first, '', storage);
    expect(readInstallationReportDraft(first, storage)).toBe('');
    expect(readInstallationReportDraft(second, storage)).toBe('Đang soạn');
  });
  it('ignores corrupted or incompatible stored data', () => {
    const storage = draftStore();
    for (const value of ['broken json', 'null', '{"text":42}', '"old format"']) {
      storage.setItem('report', value);
      expect(readInstallationReportDraft('report', storage)).toBe('');
    }
  });
  it('reports storage failure so UI can warn instead of claiming the draft is saved', () => {
    const denied = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('quota');
      },
      removeItem: () => {
        throw new Error('denied');
      },
    };
    expect(readInstallationReportDraft('report', denied)).toBe('');
    expect(saveInstallationReportDraft('report', 'Đang soạn', denied)).toBe(false);
    expect(saveInstallationReportDraft('report', '', denied)).toBe(false);
  });
});

describe('writes requiring state reconciliation', () => {
  it('requires a read after a transport error, server error, stale version or missing target', () => {
    for (const error of [
      new TypeError('timeout'),
      new ApiError(500, 'server error'),
      new ApiError(503, 'unavailable'),
      new ApiError(409, 'conflict'),
      new ApiError(404, 'gone'),
    ]) {
      expect(requiresOutcomeCheck(error)).toBe(true);
    }
  });
  it('allows correcting definitive validation/authentication rejections', () => {
    for (const status of [400, 401, 403, 422])
      expect(requiresOutcomeCheck(new ApiError(status, 'rejected'))).toBe(false);
  });
});
