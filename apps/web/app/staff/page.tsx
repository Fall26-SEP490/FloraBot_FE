import type { Metadata } from 'next';
import PortalClient from '../portal-client';

export const metadata: Metadata = { title: 'Công việc nhân viên | FloraBot' };

export default function Page() {
  return <PortalClient screen="staff" />;
}
