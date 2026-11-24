import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import FlowerShop from '@/features/catalog/FlowerShop';
import { shopCatalogPath } from '@/features/catalog/catalog.navigation';

export const metadata: Metadata = { title: 'Cửa hàng hoa | FloraBot' };

export default async function ShopPage({ params }: { params: Promise<{ sellerId: string }> }) {
  const { sellerId } = await params;
  if (!shopCatalogPath(sellerId)) notFound();
  return <FlowerShop storefrontSellerId={sellerId.toLowerCase()} />;
}
