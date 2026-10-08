import { useQuery } from '@tanstack/react-query';
import { Button } from '@florabot/ui';
import type { components } from '../../../packages/contracts/src/generated/api';
import { request } from './api';

export default function FinancialProofs({
  purpose,
  resourceId,
}: {
  purpose: 'confirm_refund' | 'pay_withdrawal';
  resourceId: string;
}) {
  const query = useQuery({
    queryKey: ['financial-proofs', purpose, resourceId],
    queryFn: () =>
      request<components['schemas']['IncidentEvidenceResponse']>(
        `/admin/evidence/${purpose}/${resourceId}`,
      ),
  });
  if (query.isPending) return <p role="status">Đang tải chứng từ…</p>;
  if (query.isError)
    return (
      <div>
        <p role="alert">Chưa tải được chứng từ.</p>
        <Button variant="outline" onClick={() => void query.refetch()}>
          Tải lại chứng từ
        </Button>
      </div>
    );
  if (!query.data.items.length) return <p>Chưa có ảnh chứng từ trong hồ sơ.</p>;
  return (
    <ul>
      {query.data.items.map((item, index) => (
        <li key={item.id}>
          <a
            href={`/api/admin/evidence/${encodeURIComponent(item.id)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Xem chứng từ {index + 1} (mở tab mới)
          </a>
        </li>
      ))}
    </ul>
  );
}
