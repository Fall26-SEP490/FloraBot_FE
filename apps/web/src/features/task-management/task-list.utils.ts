type Page<T> = { items: T[]; hasMore: boolean };

export async function readAllTaskPages<T extends { id: string }>(
  read: (page: number) => Promise<Page<T>>,
): Promise<Page<T>> {
  const items = new Map<string, T>();
  for (let page = 1; page <= 1000; page++) {
    const result = await read(page);
    const before = items.size;
    result.items.forEach((item) => items.set(item.id, item));
    if (!result.hasMore) return { items: [...items.values()], hasMore: false };
    if (items.size === before) throw new Error('Danh sách phân trang không tiến triển.');
  }
  throw new Error('Chưa tải đủ danh sách công việc.');
}

export function matchesTaskSearch(values: (string | null | undefined)[], search: string) {
  const normalize = (value: string) =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  const haystack = normalize(values.filter(Boolean).join(' '));
  return normalize(search)
    .split(/\s+/)
    .every((word) => haystack.includes(word));
}

export function newestFirst<T extends { id: string; createdAt?: string; updatedAt?: string }>(
  items: T[],
  review = false,
): T[] {
  const time = (item: T) => Date.parse((review ? item.updatedAt : item.createdAt) || '') || 0;
  return [...items].sort((a, b) => time(b) - time(a) || b.id.localeCompare(a.id));
}
