import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button } from '@florabot/ui';
import { ApiError, queryClient, request } from '@/shared/lib/api';

type InventoryScope = {
  slotCode: string;
  action: 'LOAD' | 'REMOVE' | 'REPLACE';
  status: string;
  sessionStage: string | null;
  sessionSubstate: string | null;
};
const actions = { LOAD: 'Nạp hoa', REMOVE: 'Thu hồi hoa', REPLACE: 'Thay hoa' };
const operations = {
  START: 'Mở ô',
  OPEN_NEXT: 'Mở ô để nạp hoa mới',
  OPEN_FOR_CHECK: 'Mở ô để kiểm tra',
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
      query.state.data?.status === 'IN_PROGRESS' &&
      !['Completed', 'Recovered'].includes(query.state.data.sessionStage ?? '')
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
      request(`/staff/tasks/${taskId}/inventory-maintenance/open`, {
        operation: step,
        reason: step === 'OPEN_FOR_CHECK' ? reason.trim() : null,
      }),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: ['staff-inventory-maintenance', taskId] }),
  });
  return (
    <section className="staff-resolution" aria-label="Thao tác ô Walk-in có cảm biến">
      <h4>
        {actions[scope.action]} · Ô {scope.slotCode}
      </h4>
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
                    : 'Đến đúng kiosk trước khi mở ô được giao.'}
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
      {issue.isSuccess && scope.sessionStage !== 'Completed' && (
        <p role="status">Đã gửi yêu cầu mở ô. Chờ tủ phản hồi.</p>
      )}
      {operation && (
        <Button
          type="button"
          variant="outline"
          disabled={issue.isPending || (operation === 'OPEN_FOR_CHECK' && reason.trim().length < 5)}
          onClick={() => issue.mutate(operation)}
        >
          {issue.isPending ? 'Đang gửi yêu cầu…' : operations[operation]}
        </Button>
      )}
      {issue.error && <p role="alert">{issue.error.message}</p>}
    </section>
  );
}
