import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import PortalClient from '../../portal-client';
import { workspaceSections } from '../../../src/features/portal/config/workspaceSections';
export async function generateMetadata({
  params,
}: {
  params: Promise<{ section: string }>;
}): Promise<Metadata> {
  const { section } = await params;
  const item = workspaceSections.ADMIN.find(([key]) => key === section);
  return { title: item ? `${item[1]} | Quản trị FloraBot` : 'Quản trị | FloraBot' };
}
export default async function Page({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!workspaceSections.ADMIN.some(([key]) => key === section)) notFound();
  return <PortalClient screen="admin" section={section} />;
}
