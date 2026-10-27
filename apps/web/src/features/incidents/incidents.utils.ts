import type { AdminIncidentResponse, StaffIncidentResolutionAttempt } from './incidents.types';

export function formatIncidentDate(value: string): string {
  return new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
}

export function formatIncidentLabel(
  row: Pick<AdminIncidentResponse, 'location' | 'kioskId' | 'slot'>,
): string {
  return `${row.location?.kioskName || row.kioskId}${row.slot ? ` · Ô ${row.slot.slotCode}` : ' · Toàn kiosk'}`;
}

export function safeUrl(value: string): string | null {
  try {
    if (/^\/api\/admin\/evidence\/[0-9a-f-]{36}$/.test(value)) return value;
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

export function restoreIncidentResolutionAttempt(
  key: string,
): StaffIncidentResolutionAttempt | null {
  try {
    const value = JSON.parse(
      sessionStorage.getItem(key) || 'null',
    ) as StaffIncidentResolutionAttempt | null;
    return value &&
      typeof value.id === 'string' &&
      Number.isInteger(value.version) &&
      typeof value.report === 'string'
      ? value
      : null;
  } catch {
    return null;
  }
}
