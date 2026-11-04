'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@florabot/ui';
import { request } from '@/shared/lib/api';
import type { components } from '../../../../../packages/contracts/src/generated/api';
import './styles/flower-presence.css';

type Presence = components['schemas']['FlowerPresenceResponse'];

export function FlowerPresencePanel({ kioskId }: { kioskId: string }) {
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(0);
  const query = useQuery({
    queryKey: ['flower-presence', kioskId],
    queryFn: () => request<Presence>(`/kiosks/${encodeURIComponent(kioskId)}/flower-presence`),
    enabled: open,
    refetchInterval: open ? 5000 : false,
    retry: 1,
  });
  useEffect(() => {
    if (!open) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [open]);
  const observed = query.data?.observedAt ? Date.parse(query.data.observedAt) : 0;
  const fresh =
    query.data?.isFresh === true &&
    !query.isError &&
    query.fetchStatus !== 'paused' &&
    observed > 0 &&
    now - observed <= 45000;

  return (
    <details
      className="flower-presence"
      onToggle={(event) => {
        setOpen(event.currentTarget.open);
        setNow(Date.now());
      }}
    >
      <summary>Cảm biến hoa trong tủ</summary>
      {open && (
        <div className="flower-presence-body">
          <p className="quiet">
            Đọc cảm biến mỗi ô, tự cập nhật 5 giây/lần. Tín hiệu này chưa xác nhận khách đã lấy
            hàng.
          </p>
          <p className="quiet">
            “Không có hoa” cũng có thể do chưa cắm cảm biến. Cần kiểm tra dây và chỉnh độ nhạy khi
            lắp đặt.
          </p>
          {query.isPending && <p role="status">Đang đọc trạng thái cảm biến…</p>}
          {query.isError ? (
            <p role="alert">Chưa tải được dữ liệu cảm biến. Thử tải lại.</p>
          ) : (
            query.data && (
              <>
                <p>
                  {fresh
                    ? 'Đang nhận dữ liệu cảm biến.'
                    : 'Chưa có dữ liệu mới — chưa xác định được hoa trong tủ.'}
                </p>
                <dl className="flower-presence-list">
                  {query.data.slots?.map((slot) => {
                    const value = fresh ? slot.hasFlowers : null;
                    const label =
                      value === true
                        ? 'Có hoa'
                        : value === false
                          ? 'Không có hoa'
                          : 'Chưa xác định';
                    return (
                      <div key={slot.slotId}>
                        <dt>Ô {slot.slotCode}</dt>
                        <dd
                          data-state={
                            value === true ? 'present' : value === false ? 'absent' : 'unknown'
                          }
                        >
                          {label}
                        </dd>
                      </div>
                    );
                  })}
                </dl>
                {query.data.observedAt && (
                  <p className="quiet">
                    Lần đo gần nhất: {new Date(query.data.observedAt).toLocaleString('vi-VN')}
                  </p>
                )}
              </>
            )
          )}
          <Button
            variant="outline"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            Đọc lại cảm biến
          </Button>
        </div>
      )}
    </details>
  );
}
