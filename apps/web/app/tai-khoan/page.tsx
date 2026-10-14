import type { Metadata } from 'next';
import PortalClient from '../portal-client';

export const metadata: Metadata = { title: 'Tài khoản của tôi | FloraBot' };

export default function Page() {
  return <PortalClient screen="member" />;
}
