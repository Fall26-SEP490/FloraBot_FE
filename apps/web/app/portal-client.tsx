'use client';

import { PageSkeleton } from '@/shared/components/PageSkeleton';
import dynamic from 'next/dynamic';
import type { PortalScreen } from '../src/features/portal/portal.types';

// Receipt and session recovery use browser storage; Next owns all route selection.
const Portal = dynamic(() => import('../src/features/portal/PortalApplication'), {
  ssr: false,
  loading: () => <PageSkeleton />,
});

export default function PortalClient({
  screen,
  section,
}: {
  screen: PortalScreen;
  section?: string;
}) {
  return <Portal screen={screen} section={section} />;
}
