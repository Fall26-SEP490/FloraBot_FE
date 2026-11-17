export type RevenueReport = 'v_revenue_daily' | 'v_platform_revenue';
export type RevenueRow = Record<string, unknown>;
export type RevenueFilters = { from: string; to: string; kiosk: string };

export function isRevenueReport(name: string): name is RevenueReport {
  return name === 'v_revenue_daily' || name === 'v_platform_revenue';
}

// PostgreSQL bigint may arrive as a string. Never round financial values through Number.
export function revenueInteger(value: unknown): bigint | null {
  if (typeof value === 'number') return Number.isSafeInteger(value) ? BigInt(value) : null;
  if (typeof value === 'string' && /^-?\d+$/.test(value)) return BigInt(value);
  return null;
}

export function sumLoadedRevenue(rows: RevenueRow[], key: string): bigint | null {
  let total = 0n;
  for (const row of rows) {
    const value = revenueInteger(row[key]);
    if (value === null) return null;
    total += value;
  }
  return total;
}

export function filterLoadedRevenue(
  report: RevenueReport,
  rows: RevenueRow[],
  filters: RevenueFilters,
) {
  const invalidRange = Boolean(filters.from && filters.to && filters.from > filters.to);
  const periodKey = report === 'v_platform_revenue' ? 'thang' : 'ngay';
  const length = report === 'v_platform_revenue' ? 7 : 10;
  const filtered = invalidRange
    ? []
    : rows
        .filter((row) => {
          const period = typeof row[periodKey] === 'string' ? row[periodKey].slice(0, length) : '';
          if ((filters.from || filters.to) && !period) return false;
          return (
            (!filters.from || period >= filters.from) &&
            (!filters.to || period <= filters.to) &&
            (!filters.kiosk || report !== 'v_revenue_daily' || row.kiosk === filters.kiosk)
          );
        })
        .sort(
          (a, b) =>
            String(b[periodKey] ?? '').localeCompare(String(a[periodKey] ?? '')) ||
            String(a.kiosk ?? '').localeCompare(String(b.kiosk ?? ''), 'vi'),
        );
  return { rows: filtered, invalidRange };
}
