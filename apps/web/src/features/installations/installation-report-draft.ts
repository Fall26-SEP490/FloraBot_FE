export function installationReportDraftKey(actorId: string, jobId: string): string {
  return `florabot:installation-report:v1:${encodeURIComponent(actorId)}:${encodeURIComponent(jobId)}`;
}

type DraftStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function readInstallationReportDraft(key: string, storage?: DraftStorage): string {
  try {
    const raw = (storage ?? window.sessionStorage).getItem(key);
    if (!raw) return '';
    const draft: unknown = JSON.parse(raw);
    return draft !== null &&
      typeof draft === 'object' &&
      'text' in draft &&
      typeof draft.text === 'string'
      ? draft.text
      : '';
  } catch {
    return '';
  }
}

export function saveInstallationReportDraft(
  key: string,
  text: string,
  storage?: DraftStorage,
): boolean {
  try {
    const target = storage ?? window.sessionStorage;
    if (text) target.setItem(key, JSON.stringify({ text }));
    else target.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
