import type { Metadata } from 'next';
import PortalClient from '../portal-client';
import { FlowerAdvisor } from '@/features/flower-advisor/FlowerAdvisor';

export const metadata: Metadata = { title: 'Đặt hoa | FloraBot' };

export default function Page() {
  return (
    <>
      <PortalClient screen="shop" />
      <FlowerAdvisor />
    </>
  );
}
