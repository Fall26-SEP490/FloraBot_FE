'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@florabot/ui';
import { kioskPricingQuery, pricingReady } from '../kiosk-pricing/kiosk-pricing';
import { SlotDemandFields } from '../kiosk-pricing/SlotDemandFields';

export function LandingPricing() {
  const query = useQuery(kioskPricingQuery);
  const [walk, setWalk] = useState(1);
  const [pre, setPre] = useState(0);
  return (
    <div className="landing-pricing-data" aria-busy={query.isPending}>
      {query.isPending && <p role="status">Đang tải bảng giá…</p>}
      {query.isError && (
        <div role="alert">
          <p>Chưa tải được bảng giá thuê ô.</p>
          <Button onClick={() => void query.refetch()}>Tải lại bảng giá</Button>
        </div>
      )}
      {query.isSuccess && !pricingReady(query.data) && (
        <p role="status">Chưa có bảng giá. Quản lý đang cập nhật giá thuê.</p>
      )}
      {pricingReady(query.data) && (
        <>
          <SlotDemandFields
            pricing={query.data!}
            walkInSlots={walk}
            preorderSlots={pre}
            onChange={(w, p) => {
              setWalk(w);
              setPre(p);
            }}
          />
          <Link className="button button-primary" href="/thue-kiosk">
            Đăng ký thuê kiosk →
          </Link>
        </>
      )}
    </div>
  );
}
