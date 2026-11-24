import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { RatingFilter } from '../catalog.constants';
import type { CatalogItem } from '../catalog.types';
import { isPreorder } from '../catalog.utils';
import {
  PRODUCT_REVIEWS_STALE_TIME,
  productReviewsQuery,
  readReviewRating,
  type ProductReviewPage,
} from '../product-reviews.api';

const REVIEW_BATCH_SIZE = 4;

export function useCatalogRatings(
  items: CatalogItem[],
  productFilter: RatingFilter,
  shopFilter: RatingFilter,
) {
  const queryClient = useQueryClient();
  const filterProducts = productFilter !== 'all';
  const filterShops = shopFilter !== 'all';
  const { shopProducts, productIds } = useMemo(() => {
    const shopProducts = new Map<string, string>();
    const productIds = new Set<string>();
    if (filterProducts || filterShops) {
      for (const item of items) {
        if (item.isDemoSample || !isPreorder(item)) continue;
        if (!shopProducts.has(item.sellerId)) shopProducts.set(item.sellerId, item.productId);
        if (filterProducts) productIds.add(item.productId);
      }
      if (!filterProducts) {
        for (const id of shopProducts.values()) productIds.add(id);
      }
    }
    return { shopProducts, productIds: [...productIds].sort() };
  }, [filterProducts, filterShops, items]);

  const reviews = useQuery({
    queryKey: ['flower-reviews', 'catalog', productIds],
    enabled: productIds.length > 0,
    staleTime: PRODUCT_REVIEWS_STALE_TIME,
    queryFn: async ({ signal }) => {
      const summaries = new Map<string, ProductReviewPage>();
      for (let offset = 0; offset < productIds.length; offset += REVIEW_BATCH_SIZE) {
        signal.throwIfAborted();
        const batch = productIds.slice(offset, offset + REVIEW_BATCH_SIZE);
        const pages = await Promise.all(
          batch.map((id) =>
            queryClient.fetchQuery({
              ...productReviewsQuery(id),
              staleTime: PRODUCT_REVIEWS_STALE_TIME,
            }),
          ),
        );
        batch.forEach((id, index) => summaries.set(id, pages[index]));
      }
      return summaries;
    },
  });

  const filteredItems = useMemo(() => {
    if (!filterProducts && !filterShops) return items;
    return items.filter((item) => {
      if (item.isDemoSample || !isPreorder(item)) return false;
      if (filterProducts) {
        const page = reviews.data?.get(item.productId);
        const score = readReviewRating(page?.productAverage, page?.productCount);
        if (!score || score.average < Number(productFilter)) return false;
      }
      if (filterShops) {
        const productId = shopProducts.get(item.sellerId);
        const page = productId ? reviews.data?.get(productId) : undefined;
        const score = readReviewRating(page?.shopAverage, page?.shopCount);
        if (!score || score.average < Number(shopFilter)) return false;
      }
      return true;
    });
  }, [filterProducts, filterShops, items, productFilter, reviews.data, shopFilter, shopProducts]);

  return {
    filteredItems,
    isLoading: productIds.length > 0 && reviews.isPending,
    isError: reviews.isError && !reviews.data,
    refetch: reviews.refetch,
  };
}
