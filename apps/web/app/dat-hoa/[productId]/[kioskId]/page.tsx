import FlowerDetail from '@/features/catalog/FlowerDetail';

export default async function FlowerDetailPage({
  params,
}: {
  params: Promise<{ productId: string; kioskId: string }>;
}) {
  const { productId, kioskId } = await params;
  return <FlowerDetail productId={productId} kioskId={kioskId} />;
}
