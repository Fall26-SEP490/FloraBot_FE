import type { Metadata } from 'next';
import PortalClient from '../../portal-client';

export const metadata: Metadata = {
  title: 'Lắp đặt Kiosk | FloraBot',
  description: 'Quản lý công việc lắp đặt kiosk và minh chứng hiện trường.',
};

export default function TechnicianInstallationsPage() {
  return <PortalClient screen="technician-installations" section="installations" />;
}
