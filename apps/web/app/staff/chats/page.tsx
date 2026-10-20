import type { Metadata } from 'next';
import PortalClient from '../../portal-client';

export const metadata: Metadata = { title: 'Nhắn với chủ shop | FloraBot' };

export default function Page() {
  return <PortalClient screen="staff" section="chats" />;
}
