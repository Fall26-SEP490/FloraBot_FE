import type { Metadata } from 'next';
import PortalClient from '../../portal-client';

export const metadata: Metadata = { title: 'Đăng nhập nhân sự | FloraBot' };

export default function Page() {
  return <PortalClient screen="admin-login" />;
}
