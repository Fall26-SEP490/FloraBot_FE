export function totalPages(totalItems: number, pageSize: number) {
  if (pageSize <= 0) throw new Error('pageSize must be greater than zero');
  return Math.max(1, Math.ceil(Math.max(0, totalItems) / pageSize));
}

export function clampPage(page: number, totalItems: number, pageSize: number) {
  return Math.min(Math.max(1, page), totalPages(totalItems, pageSize));
}

export function pageRange(page: number, totalItems: number, pageSize: number) {
  const safePage = clampPage(page, totalItems, pageSize);
  if (totalItems <= 0) return { start: 0, end: 0 };
  const start = (safePage - 1) * pageSize;
  return { start, end: Math.min(start + pageSize, totalItems) };
}

export function paginate<T>(items: readonly T[], page: number, pageSize: number) {
  const { start, end } = pageRange(page, items.length, pageSize);
  return items.slice(start, end);
}
