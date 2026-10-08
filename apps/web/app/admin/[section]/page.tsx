import { notFound } from 'next/navigation';
import PortalClient from '../../portal-client';
import { workspaceSections } from '../../../src/workspaceSections';
export default async function Page({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!workspaceSections.ADMIN.some(([key]) => key === section)) notFound();
  return <PortalClient screen="admin" section={section} />;
}
