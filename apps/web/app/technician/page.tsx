import type { Metadata } from 'next';
import PortalClient from '../portal-client';

export const metadata: Metadata = { title: 'Công việc kỹ thuật | FloraBot' };

export default function Page() {
  return <PortalClient screen="technician" />;
}
