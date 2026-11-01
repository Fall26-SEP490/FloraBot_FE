import type { CatalogItem, CatalogResponse } from './catalog.types';

// Apply customer filters to the complete catalog, never to just one API page.
export async function loadCatalog(
  fetchPage: (page: number) => Promise<CatalogResponse>,
): Promise<CatalogItem[]> {
  const items = new Map<string, CatalogItem>();
  for (let page = 1; page <= 100; page++) {
    const response = await fetchPage(page);
    for (const item of response.items) {
      items.set(`${item.productId}:${item.kioskId}:${item.zone ?? 'template'}`, item);
    }
    if (!response.hasMore) return [...items.values()];
  }
  throw new Error('Chưa tải hết danh mục. Vui lòng thử lại sau.');
}
