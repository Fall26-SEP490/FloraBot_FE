import { useState } from 'react';
import MaintenanceCodeForm from '@/shared/components/MaintenanceCodeForm';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button } from '@florabot/ui';
import { ApiError, queryClient, request } from '@/shared/lib/api';
import type { components } from '../../../../../packages/contracts/src/generated/api';

type Access = components['schemas']['MaintenanceAccessIssued'];

type InventoryScope = {
  slotCode: string;
  action: 'LOAD' | 'REMOVE' | 'REPLACE';
  status: string;
  sessionStage: string | null;
  sessionSubstate: string | null;
};
export const inventoryActionLabels = {
  LOAD: 'Nạp hoa',
  REMOVE: 'Thu hồi hoa',
  REPLACE: 'Thay hoa',
};
const operations = {
  START: 'Mở ô',
  OPEN_NEXT: 'Mở ô để nạp hoa mới',
  OPEN_FOR_CHECK: 'Mở ô để kiểm tra',
};

export function useStaffInventoryMaintenance(
  taskId: string,
  actorId: string | undefined,
  enabled: boolean,
  watch = enabled,
  scopeVersion?: string,
) {
  return useQuery({
    queryKey: ['staff-inventory-maintenance', taskId, actorId, scopeVersion],
    enabled,
    queryFn: async () => {
      try {
        return await request<InventoryScope>(`/staff/tasks/${taskId}/inventory-maintenance`);
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) return null;
        throw error;
      }
    },
    refetchInterval: (query) =>
      watch &&
      query.state.data?.status === 'IN_PROGRESS' &&
      !['Completed', 'Recovered'].includes(query.state.data.sessionStage ?? '')
        ? 4_000
        : false,
  });
}

export default function StaffInventoryMaintenance({
  taskId,
  scope,
  useKioskCode = false,
}: {
  taskId: string;
  scope: InventoryScope;
  useKioskCode?: boolean;
}) {
  const [reason, setReason] = useState('');
  const operation =
    scope.status !== 'IN_PROGRESS'
      ? null
      : !scope.sessionStage
        ? 'START'
        : scope.sessionStage === 'NeedsInspection'
          ? 'OPEN_FOR_CHECK'
          : scope.sessionSubstate === 'RemovalClosedEmptyConfirmed'
            ? 'OPEN_NEXT'
            : null;
  const issue = useMutation({
    gcTime: useKioskCode ? 0 : undefined,
    mutationFn: (step: keyof typeof operations) =>
      request<Access>(
        `/staff/tasks/${taskId}/inventory-maintenance/${useKioskCode ? 'access' : 'open'}`,
        {
          operation: step,
          reason: step === 'OPEN_FOR_CHECK' ? reason.trim() : null,
        },
        !useKioskCode,
      ),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: ['staff-inventory-maintenance', taskId] }),
  });
  return (
    <section
      className="staff-resolution staff-slot-operation"
      aria-label="Thao tác ô tủ có cảm biến"
    >
      <div className="staff-slot-operation-heading">
        <span className="staff-slot-operation-code" aria-hidden="true">
          {scope.slotCode}
        </span>
        <div>
          <span className="staff-slot-operation-caption">Ô tủ được giao</span>
          <h4>
            {inventoryActionLabels[scope.action]} · Ô {scope.slotCode}
          </h4>
        </div>
      </div>
      <p role="status">
        {scope.sessionStage === 'Completed'
          ? 'Tủ đã xác nhận thao tác hoàn tất. Bạn có thể gửi báo cáo công việc.'
          : scope.sessionStage === 'Recovered'
            ? 'Đội vận hành đã kết thúc phiên lỗi. Liên hệ chủ shop để hủy công việc cũ và giao lại nếu cần.'
            : scope.status !== 'IN_PROGRESS'
              ? 'Bắt đầu công việc để mở ô.'
              : scope.sessionStage === 'NeedsInspection'
                ? 'Tủ cần kiểm tra. Mô tả tình trạng trước khi mở ô.'
                : operation === 'OPEN_NEXT'
                  ? 'Đã lấy hoa cũ. Mở ô lần nữa để đặt hoa mới vào.'
                  : scope.sessionStage
                    ? 'Đóng cửa sau khi thao tác rồi chờ tủ xác nhận qua cảm biến.'
                    : scope.action === 'REMOVE'
                      ? 'Mở ô, lấy hoa về shop rồi đóng cửa. Chờ tủ xác nhận đã thu hồi.'
                      : scope.action === 'REPLACE'
                        ? 'Mở ô để lấy hoa cũ, đóng cửa rồi chờ xác nhận trước khi nạp hoa mới.'
                        : 'Mở ô, đặt hoa vào rồi đóng cửa. Chờ tủ xác nhận đã nạp hoa.'}
      </p>
      {operation === 'OPEN_FOR_CHECK' && (
        <label>
          Lý do kiểm tra ô
          <textarea
            value={reason}
            maxLength={500}
            onChange={(event) => setReason(event.target.value)}
          />
        </label>
      )}
      {issue.isSuccess &&
        scope.sessionStage !== 'Completed' &&
        (useKioskCode ? (
          <div>
            <p>
              Mã thao tác: <strong>{issue.data.code}</strong>
            </p>
            <MaintenanceCodeForm
              key={issue.data.id}
              challenge={issue.data}
              onConfirmed={() => {
                void queryClient.invalidateQueries({
                  queryKey: ['staff-inventory-maintenance', taskId],
                });
              }}
            />
          </div>
        ) : (
          <p role="status">Đã gửi yêu cầu mở ô. Chờ tủ phản hồi.</p>
        ))}
      {operation && (
        <p className="staff-slot-operation-location">Chỉ mở ô khi đang ở đúng kiosk được giao.</p>
      )}
      {operation && (
        <Button
          type="button"
          variant="default"
          className="staff-slot-operation-button"
          disabled={issue.isPending || (operation === 'OPEN_FOR_CHECK' && reason.trim().length < 5)}
          onClick={() => issue.mutate(operation)}
        >
          {issue.isPending
            ? 'Đang gửi yêu cầu…'
            : useKioskCode
              ? 'Lấy mã mở ô'
              : operation === 'START'
                ? `Mở ô ${scope.slotCode}`
                : operations[operation]}
        </Button>
      )}
      {issue.error && <p role="alert">{issue.error.message}</p>}
    </section>
  );
}
