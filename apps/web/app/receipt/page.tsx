import type { Metadata } from 'next';
import PortalClient from '../portal-client';

export const metadata: Metadata = { title: 'Biên nhận đơn hoa | FloraBot' };

export default function Page() {
  return <PortalClient screen="receipt" />;
}
