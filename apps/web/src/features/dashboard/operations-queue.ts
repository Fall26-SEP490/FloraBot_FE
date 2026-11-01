/** A bounded, deduplicated count. Partial totals are explicitly marked for the UI. */
export async function readOperationsCount<T extends { id: string }>(
  fetchPage: (page: number) => Promise<{ items: T[]; hasMore: boolean }>,
  signal?: AbortSignal,
  limit = 50,
) {
  const ids = new Set<string>();
  let hasMore = true;
  for (let page = 1; hasMore && page <= limit; page++) {
    signal?.throwIfAborted();
    const result = await fetchPage(page);
    signal?.throwIfAborted();
    if (!Array.isArray(result.items) || typeof result.hasMore !== 'boolean')
      throw new Error('Invalid operations page');
    const before = ids.size;
    for (const item of result.items) {
      if (!item.id) throw new Error('Missing operations identity');
      ids.add(item.id);
    }
    if (result.hasMore && ids.size === before)
      throw new Error('Operations pagination did not advance');
    hasMore = result.hasMore;
  }
  return { count: ids.size, hasMore };
}
