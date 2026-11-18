export type ReportPeriod = { from: string; to: string };

function validDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '1900-01-01') return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

export function sellerReportPeriod(
  mode: 'month' | 'range',
  month: string,
  from: string,
  to: string,
): ReportPeriod | null {
  if (mode === 'month') {
    if (!/^\d{4}-\d{2}$/.test(month)) return null;
    from = `${month}-01`;
    if (!validDay(from)) return null;
    const [year, number] = month.split('-').map(Number);
    to = `${month}-${String(new Date(Date.UTC(year, number, 0)).getUTCDate()).padStart(2, '0')}`;
  }
  if (!validDay(from) || !validDay(to) || from > to) return null;
  // BE currently uses inclusive <= to; preserve PostgreSQL microsecond precision.
  return { from: `${from}T00:00:00+07:00`, to: `${to}T23:59:59.999999+07:00` };
}

export function vietnamToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function leaseDaysRemaining(periodTo: string, now = new Date()): number | null {
  if (periodTo.includes('T')) {
    const delta = Date.parse(periodTo) - now.valueOf();
    if (!Number.isFinite(delta)) return null;
    return delta < 0 ? Math.floor(delta / 86_400_000) : Math.ceil(delta / 86_400_000);
  }
  if (!validDay(periodTo)) return null;
  return Math.round(
    (Date.parse(`${periodTo}T00:00:00Z`) - Date.parse(`${vietnamToday(now)}T00:00:00Z`)) /
      86_400_000,
  );
}
