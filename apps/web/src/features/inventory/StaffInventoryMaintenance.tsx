import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button } from '@florabot/ui';
import { ApiError, queryClient, request } from '@/shared/lib/api';
import { MaintenanceCode, useMaintenanceCode, type MaintenanceAccess } from './MaintenanceCode';

type InventoryScope = {
  slotCode: string;
  action: 'LOAD' | 'REMOVE' | 'REPLACE';
  status: string;
  sessionStage: string | null;
  sessionSubstate: string | null;
};
const actions = { LOAD: 'Nạp hoa', REMOVE: 'Thu hồi hoa', REPLACE: 'Thay hoa' };
const operations = {
  START: 'Lấy mã mở ô',
  OPEN_NEXT: 'Lấy mã mở ô để nạp hoa mới',
  OPEN_FOR_CHECK: 'Lấy mã mở ô để kiểm tra',
};

export function useStaffInventoryMaintenance(
  taskId: string,
  actorId: string | undefined,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ['staff-inventory-maintenance', taskId, actorId],
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
      query.state.data?.status === 'IN_PROGRESS' && query.state.data.sessionStage !== 'Completed'
        ? 4_000
        : false,
  });
}

export default function StaffInventoryMaintenance({
  taskId,
  scope,
}: {
  taskId: string;
  scope: InventoryScope;
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
    mutationFn: (step: keyof typeof operations) =>
      request<MaintenanceAccess>(`/staff/tasks/${taskId}/inventory-maintenance/access`, {
        operation: step,
        reason: step === 'OPEN_FOR_CHECK' ? reason.trim() : null,
      }),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: ['staff-inventory-maintenance', taskId] }),
  });
  const access = useMaintenanceCode(issue.variables === operation ? issue.data : undefined);
  return (
    <section className="staff-resolution" aria-label="Thao tác ô Walk-in có cảm biến">
      <h4>
        {actions[scope.action]} · Ô {scope.slotCode}
      </h4>
      <p role="status">
        {scope.sessionStage === 'Completed'
          ? 'Tủ đã xác nhận thao tác hoàn tất. Bạn có thể gửi báo cáo công việc.'
          : scope.status !== 'IN_PROGRESS'
            ? 'Bắt đầu công việc để lấy mã mở ô.'
            : scope.sessionStage === 'NeedsInspection'
              ? 'Tủ cần kiểm tra. Mô tả tình trạng trước khi lấy mã.'
              : operation === 'OPEN_NEXT'
                ? 'Đã lấy hoa cũ. Mở ô lần nữa để đặt hoa mới vào.'
                : scope.sessionStage
                  ? 'Đóng cửa sau khi thao tác rồi chờ tủ xác nhận qua cảm biến.'
                  : 'Đến đúng kiosk để lấy mã mở ô được giao.'}
      </p>
      {operation === 'OPEN_FOR_CHECK' && !access && (
        <label>
          Lý do kiểm tra ô
          <textarea
            value={reason}
            maxLength={500}
            onChange={(event) => setReason(event.target.value)}
          />
        </label>
      )}
      {access && <MaintenanceCode access={access} />}
      {operation && !access && (
        <Button
          type="button"
          variant="outline"
          disabled={issue.isPending || (operation === 'OPEN_FOR_CHECK' && reason.trim().length < 5)}
          onClick={() => issue.mutate(operation)}
        >
          {issue.isPending ? 'Đang lấy mã…' : operations[operation]}
        </Button>
      )}
      {issue.error && <p role="alert">{issue.error.message}</p>}
    </section>
  );
}
