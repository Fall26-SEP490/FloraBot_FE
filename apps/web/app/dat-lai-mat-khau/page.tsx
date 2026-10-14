import type { Metadata } from 'next';
import PortalClient from '../portal-client';

export const metadata: Metadata = { title: 'Đặt lại mật khẩu | FloraBot' };

export default function Page() {
  return <PortalClient screen="reset" />;
}
