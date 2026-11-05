import { kioskPricingQuery } from '../../kiosk-pricing/kiosk-pricing';
import { useQuery } from '@tanstack/react-query';
import { ApiError, request, type Session } from '@/shared/lib/api';
import type { KioskApplicationResponse } from '../../installations/installations.types';

export function useKioskApplication(sessionData: Session | undefined) {
  const pricingQuery = useQuery(kioskPricingQuery);

  // Current application query scoped by authenticated identity
  const applicationQuery = useQuery({
    queryKey: ['current-kiosk-application', sessionData?.id],
    queryFn: async () => {
      try {
        return await request<KioskApplicationResponse>('/member/kiosk-applications/current');
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          return null;
        }
        throw err;
      }
    },
    enabled: !!sessionData,
  });

  const appData = applicationQuery.data;

  const isTerminalStatus = Boolean(
    appData &&
    (appData.status === 'CANCELLED' ||
      appData.status === 'REJECTED' ||
      appData.status === 'REFUNDED'),
  );

  const hasActiveApplication = Boolean(
    appData &&
    !isTerminalStatus &&
    !(sessionData?.role === 'SELLER' && appData.status === 'ACTIVE'),
  );

  return {
    pricingQuery,
    applicationQuery,
    appData,
    isTerminalStatus,
    hasActiveApplication,
  };
}
