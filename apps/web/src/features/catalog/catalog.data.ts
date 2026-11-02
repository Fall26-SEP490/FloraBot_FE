import type { CatalogItem } from './catalog.types';

// Apply customer filters to the complete catalog, never to just one API page.
export async function loadCatalog<T extends Pick<CatalogItem, 'productId' | 'kioskId' | 'zone'>>(
  fetchPage: (page: number) => Promise<{ items: T[]; hasMore: boolean }>,
): Promise<T[]> {
  const items = new Map<string, T>();
  for (let page = 1; page <= 100; page++) {
    const response = await fetchPage(page);
    for (const item of response.items) {
      items.set(`${item.productId}:${item.kioskId}:${item.zone ?? 'template'}`, item);
    }
    if (!response.hasMore) return [...items.values()];
  }
  throw new Error('Chưa tải hết danh mục. Vui lòng thử lại sau.');
}
