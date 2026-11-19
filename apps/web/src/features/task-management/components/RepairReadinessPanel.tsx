import { useQuery } from '@tanstack/react-query';
import { Button } from '@florabot/ui';
import { request } from '@/shared/lib/api';

type Readiness = {
  code: string | null;
  detail: string | null;
  blockingSessionId: string | null;
  blockingSessionStage: string | null;
  pendingCommandIds: string[];
};

export default function RepairReadinessPanel({
  taskId,
  apiBase,
  version,
  actorId,
}: {
  taskId: string;
  apiBase: string;
  version: number;
  actorId?: string;
}) {
  const query = useQuery({
    queryKey: ['repair-readiness', actorId, apiBase, taskId, version],
    queryFn: () => request<Readiness>(`${apiBase}/${taskId}/repair-readiness`),
    refetchInterval: 10_000,
  });
  return (
    <section aria-label="Điều kiện nghiệm thu sửa ô">
      <h4>Điều kiện nghiệm thu sửa ô</h4>
      {query.isPending ? (
        <p role="status">Đang kiểm tra điều kiện…</p>
      ) : query.isError ? (
        <p role="alert">Chưa kiểm tra được điều kiện sửa ô.</p>
      ) : (
        <>
          <p role="status">
            {query.data.detail ||
              'Đủ điều kiện kiểm tra hiện tại. Gửi báo cáo hoặc nghiệm thu sẽ kiểm tra lại.'}
          </p>
          {query.data.blockingSessionId && (
            <p>
              Phiên đang giữ ô <code>{query.data.blockingSessionId}</code> (
              {query.data.blockingSessionStage})
            </p>
          )}
          {query.data.pendingCommandIds.length > 0 && (
            <div>
              <p>Lệnh chưa kết thúc</p>
              <ul>
                {query.data.pendingCommandIds.map((id) => (
                  <li key={id}>
                    <code>{id}</code>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
      <Button variant="outline" disabled={query.isFetching} onClick={() => void query.refetch()}>
        Kiểm tra lại điều kiện
      </Button>
    </section>
  );
}
