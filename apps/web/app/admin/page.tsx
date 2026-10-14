import type { Metadata } from 'next';
import PortalClient from '../portal-client';

export const metadata: Metadata = { title: 'Tổng quan quản trị | FloraBot' };

export default function Page() {
  return <PortalClient screen="admin" />;
}
