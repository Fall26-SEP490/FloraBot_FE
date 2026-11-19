function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

export function matchesAuditSearch(fields: readonly string[], query: string): boolean {
  const phrase = normalize(query);
  return !phrase || fields.some((field) => normalize(field).includes(phrase));
}

/** Read all BE pages before exposing a complete search result. */
export async function loadAuditPages<T extends { id: string | number }>(
  fetchPage: (page: number) => Promise<{ items: T[]; hasMore: boolean }>,
  signal?: AbortSignal,
): Promise<T[]> {
  const entries = new Map<string, T>();
  for (let page = 1; page <= 100000; page += 1) {
    signal?.throwIfAborted();
    const result = await fetchPage(page);
    signal?.throwIfAborted();
    for (const item of result.items) entries.set(String(item.id), item);
    if (!result.hasMore) return [...entries.values()];
    if (!result.items.length) throw new Error('Nhật ký chưa tải đầy đủ. Vui lòng thử lại.');
  }
  throw new Error('Vượt phạm vi phân trang của API nhật ký.');
}
