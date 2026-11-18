'use client';

import { useQuery } from '@tanstack/react-query';
import { Phone } from '@florabot/ui';
import { FlowerAdvisor } from '@/features/flower-advisor/FlowerAdvisor';
import { sessionQuery } from '@/shared/lib/api';

export function SiteSupport() {
  const session = useQuery({ ...sessionQuery, refetchOnWindowFocus: false });
  const user = session.data;
  const phone = process.env.NEXT_PUBLIC_SUPPORT_PHONE?.trim() || '0355 357 665';
  const phoneLink = 'tel:' + phone.replace(/[^+\d]/g, '');
  const label = 'Gọi hotline ' + phone;

  return (
    <aside className="site-support" aria-label="Hỗ trợ FloraBot">
      <a
        className="site-hotline-button site-support-control"
        href={phoneLink}
        aria-label={label}
        title={label}
      >
        <span className="site-support-label site-support-label--phone">{phone}</span>
        <span className="site-support-icon" aria-hidden="true">
          <Phone size={22} />
        </span>
      </a>
      <FlowerAdvisor
        key={user ? user.id + ':' + user.role : 'guest'}
        audience={user?.role === 'SELLER' ? 'seller' : 'customer'}
      />
    </aside>
  );
}
