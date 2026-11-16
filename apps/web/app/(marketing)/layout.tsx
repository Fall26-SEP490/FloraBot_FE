import type { ReactNode } from 'react';
import { FlowerAdvisor } from '../../src/features/flower-advisor/FlowerAdvisor';
import '../../src/features/marketing/landing.css';
import '../../src/features/marketing/gallery.css';

export default function MarketingRootLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <FlowerAdvisor />
    </>
  );
}
