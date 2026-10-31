'use client';

import { useCallback, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Check, CircleAlert } from '@florabot/ui';
import { queryClient, type Session } from '@/shared/lib/api';
import type { EnrollKioskResponse, ProvisionedKeyInfo } from './installations.types';
import { useInstallationList } from './hooks/useInstallationList';
import { InstallationList } from './components/InstallationList';
import { InstallationDetails } from './components/InstallationDetails';
import { EnrollKioskModal } from './components/EnrollKioskModal';
import { ProvisionedKeyModal } from './components/ProvisionedKeyModal';
import { AvailableKiosksModal } from './components/AvailableKiosksModal';
import '../../shared/styles/kiosk-shared.css';
import './styles/installation-ui.css';
import './styles/operations-installations.css';

interface OperationsInstallationsProps {
  session: Session;
}

export default function OperationsInstallations({ session }: OperationsInstallationsProps) {
  const searchParams = useSearchParams();
  const isManager = session.role === 'OPERATIONS_MANAGER';

  const lastDetailTrigger = useRef<HTMLButtonElement | null>(null);
  const [selectedAppDraft, setSelectedAppId] = useState<string | null>();
  const selectedAppId =
    selectedAppDraft === undefined ? searchParams.get('application') : selectedAppDraft;

  // Enroll & Inventory modal state
  const [enrollModalOpen, setEnrollModalOpen] = useState(false);
  const [inventoryModalOpen, setInventoryModalOpen] = useState(false);
  const [enrollSlotCount, setEnrollSlotCount] = useState(1);
  const [enrollSuccess, setEnrollSuccess] = useState<string | null>(null);

  // Once-only Provisioned Key Modal State (Memory only, never persisted)
  const [provisionedKeyInfo, setProvisionedKeyInfo] = useState<ProvisionedKeyInfo | null>(null);

  const closeEnroll = useCallback(() => setEnrollModalOpen(false), []);
  const closeKey = useCallback(() => setProvisionedKeyInfo(null), []);

  const { statusFilter, setStatusFilter, page, setPage, applicationsQuery, invalidateQueue } =
    useInstallationList(session);

  const handleRefresh = () => {
    void applicationsQuery.refetch();
    if (selectedAppId) {
      void queryClient.invalidateQueries({
        queryKey: ['operations-kiosk-application-detail', session.id, selectedAppId],
      });
    }
  };

  const handleOpenEnroll = (slotCount = 1) => {
    setEnrollSlotCount(slotCount);
    setEnrollSuccess(null);
    setEnrollModalOpen(true);
  };

  const handleEnrollSuccess = (created: EnrollKioskResponse) => {
    setEnrollModalOpen(false);
    setEnrollSuccess(
      `Đã ghi nhận thiết bị Kiosk mới: ${created.code} (${created.name}) - Ban đầu: OFFLINE.`,
    );

    if (created.apiKey) {
      setProvisionedKeyInfo({
        kioskId: created.id,
        code: created.code,
        apiKey: created.apiKey,
      });
    }
  };

  const handleSelectApp = (id: string | null, triggerButton: HTMLButtonElement) => {
    lastDetailTrigger.current = triggerButton;
    setSelectedAppId(id);
  };

  const handleCloseDetail = () => {
    setSelectedAppId(null);
    lastDetailTrigger.current?.focus();
  };

  return (
    <div className="operations-installations-view">
      {!isManager && (
        <div role="status" className="installation-readonly-notice">
          <CircleAlert size={18} aria-hidden="true" />
          <p>
            <strong>Chế độ giám sát (Admin)</strong>
            <span>
              Xem hồ sơ và tiến độ. Quản lý vận hành phụ trách xác nhận, phân công và bàn giao.
            </span>
          </p>
        </div>
      )}

      {enrollSuccess && (
        <div role="status" className="status-notice notice-success">
          <Check size={18} aria-hidden="true" />
          <span>{enrollSuccess}</span>
        </div>
      )}

      <InstallationList
        isManager={isManager}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        page={page}
        onPageChange={setPage}
        applicationsPage={applicationsQuery.data}
        isLoading={applicationsQuery.isLoading}
        isError={applicationsQuery.isError}
        isFetching={applicationsQuery.isFetching}
        selectedAppId={selectedAppId}
        onSelectApp={handleSelectApp}
        onRefresh={handleRefresh}
        onOpenEnroll={() => handleOpenEnroll(1)}
        onOpenInventory={() => setInventoryModalOpen(true)}
      />

      {selectedAppId && (
        <InstallationDetails
          key={`${session.id}-${selectedAppId}`}
          appId={selectedAppId}
          session={session}
          isManager={isManager}
          onClose={handleCloseDetail}
          onOpenEnroll={handleOpenEnroll}
          onShowProvisionedKey={setProvisionedKeyInfo}
          onInvalidateQueue={invalidateQueue}
        />
      )}

      <EnrollKioskModal
        open={enrollModalOpen}
        onClose={closeEnroll}
        session={session}
        initialSlotCount={enrollSlotCount}
        onSuccess={handleEnrollSuccess}
      />

      <AvailableKiosksModal
        open={inventoryModalOpen}
        onClose={() => setInventoryModalOpen(false)}
        session={session}
        onOpenEnroll={handleOpenEnroll}
      />

      {provisionedKeyInfo && <ProvisionedKeyModal info={provisionedKeyInfo} onClose={closeKey} />}
    </div>
  );
}
