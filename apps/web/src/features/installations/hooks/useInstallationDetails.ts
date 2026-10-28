import { useQuery } from '@tanstack/react-query';
import { queryClient, request, type Session } from '@/shared/lib/api';
import type { AccountDirectoryItem } from '../../account-management/account-management.types';
import type {
  EligibleKioskResponse,
  IncidentPhoto,
  KioskApplicationDetailResponse,
  KioskApplicationResponse,
} from '../installations.types';

interface UseInstallationDetailsOptions {
  appId: string;
  session: Session;
  isManager: boolean;
  onInvalidateQueue: () => void;
}

export function useInstallationDetails({
  appId,
  session,
  isManager,
  onInvalidateQueue,
}: UseInstallationDetailsOptions) {
  const selectedAppQuery = useQuery({
    queryKey: ['operations-kiosk-application-detail', session.id, appId],
    queryFn: () =>
      request<KioskApplicationDetailResponse>(`/operations/kiosk-applications/${appId}`),
  });

  const detailData = selectedAppQuery.data;
  const appDetail: KioskApplicationResponse | null = detailData?.application ?? null;
  const evidencePhotos: IncidentPhoto[] = detailData?.evidencePhotos ?? [];
  const needsSchedule = appDetail?.status === 'CONFIRMED' || appDetail?.status === 'SCHEDULED';

  const techniciansQuery = useQuery({
    queryKey: ['account-directory', 'TECHNICIAN', 'platform', '/operations/technicians'],
    queryFn: () => request<AccountDirectoryItem[]>('/operations/technicians'),
    enabled: isManager && needsSchedule,
  });

  const activeTechnicians = (techniciansQuery.data || []).filter((t) => t.status === 'ACTIVE');

  const eligibleKiosksQuery = useQuery({
    queryKey: ['eligible-kiosks', session.id, appDetail?.packageId],
    queryFn: () =>
      request<EligibleKioskResponse[]>(
        `/operations/eligible-kiosks?packageId=${appDetail?.packageId}`,
      ),
    enabled: isManager && needsSchedule && !!appDetail?.packageId,
  });

  const eligibleKiosks = eligibleKiosksQuery.data || [];

  const invalidateSelf = () => {
    onInvalidateQueue();
    void queryClient.invalidateQueries({
      queryKey: ['operations-kiosk-application-detail', session.id, appId],
    });
    void queryClient.invalidateQueries({
      queryKey: ['eligible-kiosks', session.id, appDetail?.packageId],
    });
  };

  return {
    selectedAppQuery,
    appDetail,
    evidencePhotos,
    needsSchedule,
    techniciansQuery,
    activeTechnicians,
    eligibleKiosksQuery,
    eligibleKiosks,
    invalidateSelf,
  };
}
