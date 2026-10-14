import { notFound } from 'next/navigation';
import PortalClient from '../../portal-client';
import { workspaceSections } from '../../../src/workspaceSections';

export default async function Page({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!workspaceSections.OPERATIONS_MANAGER.some(([key]) => key === section)) notFound();
  return <PortalClient screen="operations" section={section} />;
}
