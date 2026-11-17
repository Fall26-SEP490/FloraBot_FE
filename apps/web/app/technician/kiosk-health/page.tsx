import type { Metadata } from 'next';
import PortalClient from '../../portal-client';

export const metadata: Metadata = { title: 'Sức khỏe kiosk | FloraBot' };

export default function TechnicianKioskHealthPage() {
  return <PortalClient screen="technician" section="kiosk-health" />;
}
