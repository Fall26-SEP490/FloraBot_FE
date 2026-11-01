export function pickupWindow(pickupAt: string, pickupBefore: string, now: number) {
  const start = Date.parse(pickupAt);
  const end = Date.parse(pickupBefore);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 'unknown';
  return now < start ? 'early' : now >= end ? 'expired' : 'within';
}
