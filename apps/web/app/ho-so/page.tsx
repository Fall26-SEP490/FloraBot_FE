import type { Metadata } from 'next';
import PortalClient from '../portal-client';

export const metadata: Metadata = { title: 'Hồ sơ cá nhân | FloraBot' };

export default function Page() {
  return <PortalClient screen="profile" />;
}
