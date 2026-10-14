import type { Metadata } from 'next';
import PortalClient from '../portal-client';

export const metadata: Metadata = { title: 'Đăng nhập | FloraBot' };

export default function Page() {
  return <PortalClient screen="login" />;
}
