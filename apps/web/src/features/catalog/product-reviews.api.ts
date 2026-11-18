import { request } from '@/shared/lib/api';
import type { components } from '../../../../../packages/contracts/src/generated/api';

export type ProductReviewPage = {
  productAverage: number | null;
  productCount: number;
  shopAverage: number | null;
  shopCount: number;
  items: {
    id: string;
    stars: number;
    comment: string | null;
    photoUrl: string | null;
    createdAt: string;
    reviewerName?: components['schemas']['FlowerReview']['reviewerName'] | null;
  }[];
  hasMore: boolean;
};

export function productReviewsQuery(productId: string, page = 1) {
  return {
    queryKey: ['flower-reviews', productId, page],
    queryFn: async () => {
      const result = await request<ProductReviewPage>(
        `/shop/products/${encodeURIComponent(productId)}/reviews?page=${page}`,
      );
      if (!Array.isArray(result?.items)) throw new Error('Dữ liệu đánh giá không hợp lệ.');
      return result;
    },
    retry: false,
  };
}
