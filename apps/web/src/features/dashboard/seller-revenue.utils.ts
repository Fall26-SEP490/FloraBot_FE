export type RevenueView = 'month' | 'day' | 'kiosk';
export type RevenueBucket = { label: string; params: string };

export function vietnamMonth(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
  })
    .format(date)
    .slice(0, 7);
}

export function revenueRange(start: string, end: string): string {
  return new URLSearchParams({
    from: `${start}T00:00:00+07:00`,
    to: `${end}T23:59:59.999999+07:00`,
  }).toString();
}

export function revenueBuckets(view: RevenueView, year: string, month: string): RevenueBucket[] {
  if (view === 'month')
    return Array.from({ length: 12 }, (_, i) => ({
      label: `Tháng ${i + 1}`,
      params: `month=${year}-${String(i + 1).padStart(2, '0')}`,
    }));
  if (view !== 'day') return [];
  const [y, m] = month.split('-').map(Number);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: days }, (_, i) => {
    const date = `${month}-${String(i + 1).padStart(2, '0')}`;
    return {
      label: `${String(i + 1).padStart(2, '0')}/${String(m).padStart(2, '0')}`,
      params: revenueRange(date, date),
    };
  });
}

/** Bound fan-out because the existing API returns one period per call. */
export async function loadRevenueBuckets<T>(
  buckets: RevenueBucket[],
  load: (params: string) => Promise<T>,
  signal: AbortSignal,
): Promise<T[]> {
  const rows: T[] = new Array(buckets.length);
  let next = 0;
  let failed = false;
  await Promise.all(
    Array.from({ length: Math.min(4, buckets.length) }, async () => {
      while (next < buckets.length && !failed) {
        signal.throwIfAborted();
        const index = next++;
        try {
          rows[index] = await load(buckets[index].params);
          signal.throwIfAborted();
        } catch (error) {
          failed = true;
          throw error;
        }
      }
    }),
  );
  return rows;
}
