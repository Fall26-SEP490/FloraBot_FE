'use client';

import RefreshRegion from '@/shared/components/RefreshRegion';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import IconActionButton from '@/shared/components/IconActionButton';
import { request } from '@/shared/lib/api';
import type { components } from '../../../../../packages/contracts/src/generated/api';
import './styles/flower-presence.css';

type Presence = components['schemas']['FlowerPresenceResponse'];

export function FlowerPresencePanel({
  kioskId,
  alwaysOpen = false,
}: {
  kioskId: string;
  alwaysOpen?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const active = alwaysOpen || open;
  const [now, setNow] = useState(0);
  const query = useQuery({
    queryKey: ['flower-presence', kioskId],
    queryFn: () => request<Presence>(`/kiosks/${encodeURIComponent(kioskId)}/flower-presence`),
    enabled: active,
    refetchInterval: active ? 5000 : false,
    retry: 1,
  });
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [active]);
  const observed = query.data?.observedAt ? Date.parse(query.data.observedAt) : 0;
  const fresh =
    query.data?.isFresh === true &&
    !query.isError &&
    query.fetchStatus !== 'paused' &&
    observed > 0 &&
    now > 0 &&
    now - observed <= 45000;

  const content = (
    <RefreshRegion>
      <div className="flower-presence-body">
        <div className="flower-presence-toolbar">
          <p className="quiet">
            Tự cập nhật mỗi 5 giây ·{' '}
            {query.data?.observedAt
              ? `Lần đo gần nhất: ${new Date(query.data.observedAt).toLocaleString('vi-VN')}`
              : 'Chưa có lần đo'}
          </p>
          <IconActionButton
            action="reload"
            label="Đọc lại cảm biến"
            disabled={query.isFetching}
            onClick={() => query.refetch()}
          />
        </div>
        {query.isPending && <p role="status">Đang đọc trạng thái cảm biến…</p>}
        {query.isError ? (
          <p role="alert">Chưa tải được dữ liệu cảm biến. Thử tải lại.</p>
        ) : (
          query.data && (
            <>
              {fresh && (
                <p className="flower-presence-status" role="status">
                  Đang nhận dữ liệu cảm biến.
                </p>
              )}
              {query.data.slots?.length ? (
                <dl className="flower-presence-list">
                  {query.data.slots.map((slot) => {
                    const value = fresh ? slot.hasFlowers : null;
                    return (
                      <div key={slot.slotId}>
                        <dt>Ô {slot.slotCode}</dt>
                        <dd
                          data-state={
                            value === true ? 'present' : value === false ? 'absent' : 'unknown'
                          }
                        >
                          {value === true
                            ? 'Có hoa'
                            : value === false
                              ? 'Không có hoa'
                              : 'Chưa xác định'}
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              ) : (
                <p className="quiet">Chưa có dữ liệu cảm biến cho các ô tủ.</p>
              )}
            </>
          )
        )}
      </div>
    </RefreshRegion>
  );

  if (alwaysOpen)
    return (
      <section
        className="flower-presence flower-presence-expanded"
        aria-label="Cảm biến hoa trong tủ"
      >
        <h3>Cảm biến hoa trong tủ</h3>
        {content}
      </section>
    );

  return (
    <details
      className="flower-presence"
      onToggle={(event) => {
        setOpen(event.currentTarget.open);
        setNow(Date.now());
      }}
    >
      <summary>Cảm biến hoa trong tủ</summary>
      {open && content}
    </details>
  );
}
