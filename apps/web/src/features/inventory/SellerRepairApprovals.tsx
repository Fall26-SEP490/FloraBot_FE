import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button } from '@florabot/ui';
import { queryClient, request } from '@/shared/lib/api';

type Repair = {
  id: string;
  kioskName: string;
  slotCode: string;
  reason: string;
  expiresAt: string | null;
};

export default function SellerRepairApprovals({ sellerId }: { sellerId: string }) {
  const [expanded, setExpanded] = useState(false);
  const queryKey = ['seller-technical-repairs', sellerId];
  const repairs = useQuery({
    queryKey,
    queryFn: () => request<Repair[]>('/me/technical-repairs'),
    enabled: expanded,
    refetchInterval: expanded ? 15_000 : false,
  });
  const approve = useMutation({
    mutationFn: (id: string) =>
      request<{ expiresAt: string }>(`/me/technical-repairs/${id}/approve`, {}),
    onSuccess: (result, id) => {
      queryClient.setQueryData<Repair[]>(queryKey, (rows) =>
        rows?.map((row) => (row.id === id ? { ...row, expiresAt: result.expiresAt } : row)),
      );
      void queryClient.invalidateQueries({ queryKey });
    },
  });
  return (
    <details
      className="stock-maintenance"
      onToggle={(event) => setExpanded(event.currentTarget.open)}
    >
      <summary>Duyệt quyền mở ô để sửa tủ</summary>
      {expanded && repairs.isPending && <p role="status">Đang tải ca sửa…</p>}
      {repairs.isError && <p role="alert">{repairs.error.message}</p>}
      {repairs.data?.length === 0 && <p>Hiện chưa có ca sửa ô tủ cần xử lý.</p>}
      {repairs.data?.map((repair) => (
        <div key={repair.id} className="stock-maintenance-progress">
          <strong>
            {repair.kioskName} · Ô {repair.slotCode}
          </strong>
          <p>{repair.reason}</p>
          {repair.expiresAt ? (
            <p role="status">Đã duyệt đến {new Date(repair.expiresAt).toLocaleString('vi-VN')}.</p>
          ) : (
            <Button
              type="button"
              variant="outline"
              disabled={approve.isPending}
              onClick={() => approve.mutate(repair.id)}
            >
              {approve.isPending && approve.variables === repair.id
                ? 'Đang duyệt…'
                : 'Duyệt quyền mở ô'}
            </Button>
          )}
          {approve.isError && approve.variables === repair.id && (
            <p role="alert">{approve.error.message}</p>
          )}
        </div>
      ))}
    </details>
  );
}
