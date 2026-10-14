import type { Metadata } from 'next';
import PortalClient from '../portal-client';

export const metadata: Metadata = { title: 'Quên mật khẩu | FloraBot' };

export default function Page() {
  return <PortalClient screen="forgot" />;
}
