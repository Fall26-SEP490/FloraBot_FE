import type { Metadata } from 'next';
import PortalClient from '../portal-client';

export const metadata: Metadata = { title: 'Biên nhận đã lưu | FloraBot' };

export default function Page() {
  return <PortalClient screen="guest-history" />;
}
