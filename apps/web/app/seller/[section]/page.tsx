import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import PortalClient from '../../portal-client';
import { workspaceSections } from '../../../src/workspaceSections';
export async function generateMetadata({
  params,
}: {
  params: Promise<{ section: string }>;
}): Promise<Metadata> {
  const { section } = await params;
  const item = workspaceSections.SELLER.find(([key]) => key === section);
  return { title: item ? `${item[1]} | Cửa hàng FloraBot` : 'Cửa hàng | FloraBot' };
}
export default async function Page({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!workspaceSections.SELLER.some(([key]) => key === section)) notFound();
  return <PortalClient screen="seller" section={section} />;
}
