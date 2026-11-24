import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ShopReviews from '@/features/catalog/ShopReviews';
import {
  catalogReturnPath,
  shopCatalogPath,
  shopCatalogSellerId,
} from '@/features/catalog/catalog.navigation';

export const metadata: Metadata = { title: 'Đánh giá cửa hàng | FloraBot' };

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ sellerId: string }>;
  searchParams: Promise<{ page?: string | string[]; from?: string | string[] }>;
}) {
  const [{ sellerId }, query] = await Promise.all([params, searchParams]);
  const shopPath = shopCatalogPath(sellerId);
  if (!shopPath) notFound();

  const from = typeof query.from === 'string' ? catalogReturnPath(query.from) : shopPath;
  const shopHref =
    shopCatalogSellerId(from.split('?')[0]) === sellerId.toLowerCase() ? from : shopPath;
  const value = typeof query.page === 'string' ? Number(query.page) : 1;
  const page = Number.isInteger(value) && value >= 1 && value <= 10000 ? value : 1;
  return (
    <ShopReviews
      sellerId={sellerId.toLowerCase()}
      shopPath={shopPath}
      shopHref={shopHref}
      page={page}
    />
  );
}
