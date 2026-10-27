import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { queryClient, request, type Session } from '../../../api';
import type { KioskApplicationPage } from '../installations.types';

export function useInstallationList(session: Session) {
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [page, setPage] = useState(1);

  const queryPath = `/operations/kiosk-applications?page=${page}&limit=10${
    statusFilter !== 'ALL' ? `&status=${encodeURIComponent(statusFilter)}` : ''
  }`;

  const applicationsQuery = useQuery({
    queryKey: ['operations-kiosk-applications', session.id, statusFilter, page],
    queryFn: () => request<KioskApplicationPage>(queryPath),
  });

  const invalidateQueue = () => {
    void queryClient.invalidateQueries({
      queryKey: ['operations-kiosk-applications', session.id],
    });
  };

  const handleStatusFilterChange = (status: string) => {
    setStatusFilter(status);
    setPage(1);
  };

  return {
    statusFilter,
    setStatusFilter: handleStatusFilterChange,
    page,
    setPage,
    applicationsQuery,
    invalidateQueue,
  };
}
