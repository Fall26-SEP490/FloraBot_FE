import FlowerDetail from '@/features/catalog/FlowerDetail';

export default async function FlowerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ productId: string; kioskId: string }>;
  searchParams: Promise<{ zone?: string | string[] }>;
}) {
  const [{ productId, kioskId }, query] = await Promise.all([params, searchParams]);
  const zone = typeof query.zone === 'string' ? query.zone : undefined;
  return <FlowerDetail productId={productId} kioskId={kioskId} zone={zone} />;
}
