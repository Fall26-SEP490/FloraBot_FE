'use client';

import React, { useLayoutEffect } from 'react';
import '@/shared/lib/i18n';
import { PortalScreenRouter } from './PortalScreen';
import type { PortalScreen } from './portal.types';

export default function PortalApplication({
  screen,
  section,
}: {
  screen: PortalScreen;
  section?: string;
}) {
  useLayoutEffect(() => {
    const workspace = [
      'admin',
      'seller',
      'operations',
      'technician',
      'technician-installations',
      'staff',
      'member',
      'profile',
      'workspace',
      'thue-kiosk',
    ].includes(screen);
    if (workspace && !window.location.hash) {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }
  }, [screen, section]);

  return (
    <React.StrictMode>
      <PortalScreenRouter screen={screen} section={section} />
    </React.StrictMode>
  );
}
