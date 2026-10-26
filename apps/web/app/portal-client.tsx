'use client';

import dynamic from 'next/dynamic';
import type { PortalScreen } from '../src/features/portal/portal.types';

// Receipt and session recovery use browser storage; Next owns all route selection.
const Portal = dynamic(() => import('../src/features/portal/PortalApplication'), {
  ssr: false,
  loading: () => (
    <main id="main">
      <p role="status">Đang tải FloraBot...</p>
    </main>
  ),
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
