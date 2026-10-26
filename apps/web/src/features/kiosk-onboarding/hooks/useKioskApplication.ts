import { useQuery } from '@tanstack/react-query';
import { ApiError, request, type Session } from '../../../api';
import type {
  KioskApplicationResponse,
  KioskPackageResponse,
} from '../../../kioskApplicationTypes';

export function useKioskApplication(sessionData: Session | undefined) {
  // Load packages from GET /api/kiosk-packages (real server data, no silent mock fallback)
  const packagesQuery = useQuery({
    queryKey: ['kiosk-packages'],
    queryFn: () => request<KioskPackageResponse[]>('/kiosk-packages'),
  });

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

  const hasActiveApplication = Boolean(appData && !isTerminalStatus);

  return {
    packagesQuery,
    applicationQuery,
    appData,
    isTerminalStatus,
    hasActiveApplication,
  };
}
