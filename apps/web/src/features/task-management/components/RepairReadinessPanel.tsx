import { useQuery } from '@tanstack/react-query';
import { Button } from '@florabot/ui';
import Link from 'next/link';
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
  compact = false,
}: {
  taskId: string;
  apiBase: string;
  version: number;
  actorId?: string;
  compact?: boolean;
}) {
  const query = useQuery({
    queryKey: ['repair-readiness', actorId, apiBase, taskId, version],
    queryFn: () => request<Readiness>(`${apiBase}/${taskId}/repair-readiness`),
    refetchInterval: 10_000,
  });
  return (
    <section
      className="repair-readiness-panel"
      data-blocked={Boolean(query.data?.code)}
      aria-label="Điều kiện nghiệm thu sửa ô"
    >
      <h4>{compact ? 'Kiểm tra tại tủ' : 'Điều kiện nghiệm thu sửa ô'}</h4>
      {query.isPending ? (
        <p role="status">Đang kiểm tra điều kiện…</p>
      ) : query.isError ? (
        <p role="alert">Chưa kiểm tra được điều kiện sửa ô.</p>
      ) : (
        <>
          <p role="status">
            {query.data.detail ||
              (query.data.code
                ? 'Chưa đủ điều kiện sửa ô. Kiểm tra lại trạng thái công việc và thiết bị.'
                : compact
                  ? 'Đủ điều kiện nghiệm thu.'
                  : 'Đủ điều kiện hiện tại; hệ thống sẽ kiểm tra lại khi gửi.')}
          </p>
          {query.data.code === 'REPAIR_SESSION_RECOVERY_REQUIRED' &&
            apiBase.startsWith('/operations/') && (
              <Link className="button button-outline" href="/operations/maintenance-recovery">
                Kiểm tra phiên thao tác
              </Link>
            )}
          {(query.data.blockingSessionId || query.data.pendingCommandIds.length > 0) && (
            <details>
              <summary>Phiên và lệnh liên quan</summary>
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
            </details>
          )}
        </>
      )}
      <Button variant="outline" disabled={query.isFetching} onClick={() => void query.refetch()}>
        Kiểm tra lại điều kiện
      </Button>
    </section>
  );
}
