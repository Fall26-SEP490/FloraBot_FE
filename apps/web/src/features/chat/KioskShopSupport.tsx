'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button, Flower2, MessageSquare } from '@florabot/ui';
import { request, sessionQuery } from '@/shared/lib/api';
import { openCustomerChat } from './api';
import type { components } from '../../../../../packages/contracts/src/generated/api';

export default function KioskShopSupport({ kioskId }: { kioskId: string }) {
  const router = useRouter();
  const session = useQuery(sessionQuery);
  const kiosk = useQuery({
    queryKey: ['kiosk-support', kioskId],
    queryFn: () =>
      request<components['schemas']['KioskHomeInfo']>(
        `/kiosk-support/${kioskId}`,
        undefined,
        false,
      ),
  });
  const open = useMutation({
    mutationFn: () => openCustomerChat({ sellerId: kiosk.data!.sellerId! }),
    onSuccess: (chat) => {
      const query = new URLSearchParams({
        chat: chat.id,
        shopName: kiosk.data?.shopName || chat.otherPartyName,
      });
      router.push(`/tai-khoan?${query.toString()}#member-chats`);
    },
  });
  const returnUrl = `/ho-tro-cua-hang?kiosk=${kioskId}`;
  return (
    <main id="main" style={{ maxWidth: 680, margin: '0 auto', padding: '3rem 1.5rem' }}>
      <Flower2 size={42} aria-hidden="true" />
      <h1 style={{ marginBlock: '1rem' }}>Hỗ trợ từ cửa hàng hoa</h1>
      <p>
        Hoa hư, hoa không đúng hoặc cần hỗ trợ đơn? Nhắn trực tiếp cho cửa hàng phụ trách tủ này.
        Bạn có thể gửi ảnh trong cuộc trò chuyện.
      </p>
      {kiosk.isPending && <p role="status">Đang xác định cửa hàng…</p>}
      {kiosk.isError && (
        <p role="alert">Chưa tải được thông tin tủ. Vui lòng quét lại QR hoặc thử lại sau.</p>
      )}
      {kiosk.data && (
        <section
          style={{
            marginBlock: '1.5rem',
            padding: '1.5rem',
            background: '#f3f7ee',
            borderRadius: 16,
          }}
        >
          <h2>{kiosk.data.shopName || 'Chưa có cửa hàng phụ trách'}</h2>
          <p>
            {kiosk.data.name} · {kiosk.data.code}
          </p>
          <p>{kiosk.data.address}</p>
          {session.isPending ? (
            <p role="status">Đang kiểm tra đăng nhập…</p>
          ) : !session.data ? (
            <>
              <p>Đăng nhập bằng tài khoản khách hàng trên điện thoại để gửi tin nhắn riêng tư.</p>
              <Link
                className="button button-primary"
                href={`/dang-nhap?returnUrl=${encodeURIComponent(returnUrl)}`}
              >
                Đăng nhập để liên hệ shop
              </Link>
            </>
          ) : session.data.role !== 'CUSTOMER' ? (
            <p>
              Hãy sử dụng tài khoản khách hàng để liên hệ cửa hàng. Tài khoản nhân viên và chủ shop
              có khu vực làm việc riêng.
            </p>
          ) : (
            kiosk.data.sellerId && (
              <Button disabled={open.isPending} onClick={() => open.mutate()}>
                <MessageSquare size={19} aria-hidden="true" />
                {open.isPending ? 'Đang mở hội thoại…' : 'Nhắn tin với cửa hàng'}
              </Button>
            )
          )}
          {open.isError && <p role="alert">Chưa mở được hội thoại. Vui lòng thử lại.</p>}
        </section>
      )}
      <p>
        Giữ mã đơn và biên nhận. Nếu cần gửi yêu cầu xử lý hoặc hoàn tiền, hãy mở biên nhận của đơn.
      </p>
      <Link className="button button-outline" href="/receipt">
        Tra cứu biên nhận
      </Link>
    </main>
  );
}
