import { useQuery } from '@tanstack/react-query';
import { request, sessionQuery } from '@/shared/lib/api';
import type { components } from '../../../../../packages/contracts/src/generated/api';
import { fetchMemberProfile } from './customer-account.api';

export function CustomerLoyaltySummary() {
  const session = useQuery(sessionQuery);
  const loyalty = useQuery({
    queryKey: ['member-shop-loyalty', session.data?.id],
    enabled: session.data?.role === 'CUSTOMER',
    queryFn: () =>
      request<components['schemas']['MemberLoyaltyPageResponse']>(
        '/member/loyalty?page=1&pageSize=20',
      ),
  });
  const memberProfile = useQuery({
    queryKey: ['member-profile', session.data?.id],
    queryFn: fetchMemberProfile,
    enabled: session.data?.role === 'CUSTOMER',
  });
  const legacy = Number(memberProfile.data?.loyaltyPoints || 0);
  return (
    <div className="profile-loyalty-summary">
      <strong>Điểm tích lũy</strong>
      {loyalty.isPending ? (
        <span role="status">Đang tải…</span>
      ) : loyalty.isError ? (
        <button type="button" onClick={() => void loyalty.refetch()}>
          Tải lại điểm
        </button>
      ) : loyalty.data.items.length ? (
        <ul>
          {loyalty.data.items.map((item) => (
            <li key={item.sellerId}>
              {item.shopName}: <b>{Number(item.balance).toLocaleString('vi-VN')} điểm</b>
            </li>
          ))}
          {legacy > 0 && (
            <li>
              Điểm toàn hệ thống: <b>{legacy.toLocaleString('vi-VN')} điểm</b>
            </li>
          )}
        </ul>
      ) : (
        <span>{legacy > 0 ? `${legacy.toLocaleString('vi-VN')} điểm` : 'Chưa có điểm'}</span>
      )}
    </div>
  );
}
