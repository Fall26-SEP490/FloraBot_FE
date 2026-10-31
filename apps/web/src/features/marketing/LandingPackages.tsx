'use client';
import { createContext, useContext, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchLandingPackages } from './landing-api';
import { resolvePackageId, type LandingPackage } from './landing-data';

function usePackagesState() {
  const query = useQuery({ queryKey: ['landing-kiosk-packages'], queryFn: fetchLandingPackages });
  const [chosenId, setChosenId] = useState('');
  const plans = query.data ?? [];
  return { query, plans, selectedId: resolvePackageId(plans, chosenId), select: setChosenId };
}
const PackagesContext = createContext<ReturnType<typeof usePackagesState> | null>(null);
export function LandingPackagesProvider({ children }: { children: ReactNode }) {
  const state = usePackagesState();
  return <PackagesContext.Provider value={state}>{children}</PackagesContext.Provider>;
}
export function useLandingPackages() {
  const state = useContext(PackagesContext);
  if (!state) throw new Error('LandingPackagesProvider is required');
  return state;
}
export function PackageStatus({ form = false }: { form?: boolean }) {
  const { query, plans } = useLandingPackages();
  if (query.isPending)
    return (
      <p role="status" className="landing-data-status">
        Đang tải gói thuê{form ? ' cho form đăng ký' : ''}…
      </p>
    );
  if (query.isError)
    return (
      <div role="alert" className="landing-data-status">
        <p>Chưa tải được gói thuê. Vui lòng thử lại trước khi đăng ký.</p>
        <button
          type="button"
          className="button button-outline"
          onClick={() => void query.refetch()}
          disabled={query.isFetching}
        >
          Tải lại gói thuê
        </button>
      </div>
    );
  if (!plans.length)
    return (
      <p role="status" className="landing-data-status">
        Hiện chưa có gói thuê đang hoạt động. Form đăng ký tạm chưa thể gửi.
      </p>
    );
  return null;
}
function PriceCard({ plan }: { plan: LandingPackage }) {
  const { select } = useLandingPackages();
  return (
    <article className="plan" aria-labelledby={`package-${plan.id}`}>
      <div className="plan-top">
        <h3 id={`package-${plan.id}`}>{plan.name}</h3>
        <span className="plan-capacity">{plan.totalSlots} ô</span>
      </div>
      <p className="plan-price">
        <strong>{new Intl.NumberFormat('vi-VN').format(plan.annualFee)}</strong>
        <span>đ / năm</span>
      </p>
      <p>Thời hạn: {plan.termMonths} tháng</p>
      <p>{plan.description}</p>
      <a
        className="button choose-package"
        data-package={plan.id}
        href="#dang-ky"
        onClick={() => select(plan.id)}
      >
        Chọn {plan.name}
      </a>
    </article>
  );
}
export function LandingPricing() {
  const { query, plans } = useLandingPackages();
  return (
    <div className="landing-pricing-data" aria-busy={query.isPending}>
      <PackageStatus />
      {query.isSuccess && (
        <div className="price-options">
          {plans.map((plan) => (
            <PriceCard key={plan.id} plan={plan} />
          ))}
        </div>
      )}
    </div>
  );
}
