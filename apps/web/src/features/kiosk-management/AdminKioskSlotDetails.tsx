import { useCallback, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@florabot/ui';
import type { components } from '../../../../../packages/contracts/src/generated/api';
import { request } from '@/shared/lib/api';
import '../dashboard/styles/admin-approvals.css';
import { FlowerPresencePanel } from './FlowerPresencePanel';
import { AdminSlotSensors } from './AdminSlotSensors';

type Slot = components['schemas']['AdminSlotResponse'];
const slotStatus: Record<string, string> = {
  EMPTY: 'Trống',
  FREE: 'Trống',
  RENTED_EMPTY: 'Trống',
  STOCKED: 'Có hoa',
  OCCUPIED: 'Có hoa',
  RESERVED: 'Đang giữ',
  HELD: 'Đang giữ',
  LOCKED: 'Đã khóa',
  MAINTENANCE: 'Bảo trì',
  PENDING_RELEASE: 'Chờ giải phóng',
};

export function AdminKioskSlotDetails({
  kioskId,
  kioskCode,
}: {
  kioskId: string;
  kioskCode: string;
}) {
  const [open, setOpen] = useState(false);
  const [sensorSlotId, setSensorSlotId] = useState<string | null>(null);
  const closeSensors = useCallback(() => setSensorSlotId(null), []);
  const slots = useQuery({
    queryKey: ['admin-slots'],
    queryFn: () => request<Slot[]>('/admin/slots'),
    enabled: open,
  });
  const items = slots.data?.filter((slot) => slot.kioskId === kioskId) ?? [];
  const sensorSlot = items.find((slot) => slot.id === sensorSlotId);
  const regionId = `kiosk-slots-${kioskId}`;
  return (
    <div className="admin-kiosk-slot-details">
      <Button
        variant="outline"
        aria-expanded={open}
        aria-controls={regionId}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? 'Ẩn các ô tủ' : 'Xem các ô tủ'}
      </Button>
      <div id={regionId} hidden={!open}>
        {open && (
          <section aria-label={`Các ô của kiosk ${kioskCode}`}>
            <h4>Các ô của kiosk {kioskCode}</h4>
            <FlowerPresencePanel kioskId={kioskId} />
            <p className="quiet">Cấu hình giám sát cảm biến áp dụng cho ô mua tại tủ.</p>
            {slots.isPending && <p role="status">Đang tải các ô tủ…</p>}
            {slots.isError ? (
              <div role="alert">
                <p>Chưa tải được các ô của kiosk.</p>
                <Button variant="outline" onClick={() => void slots.refetch()}>
                  Tải lại các ô tủ
                </Button>
              </div>
            ) : slots.isSuccess && items.length === 0 ? (
              <p>API chưa trả về ô nào cho kiosk này.</p>
            ) : (
              <ul className="admin-kiosk-slot-list">
                {items.map((slot) => (
                  <li key={slot.id}>
                    <strong>{slot.slotCode}</strong>
                    <span>{slotStatus[slot.status] ?? slot.status}</span>
                    <span>
                      {slot.zone === 'WALK_IN'
                        ? 'Mua tại tủ'
                        : slot.zone === 'PREORDER'
                          ? 'Nhận đơn đặt trước'
                          : 'Chưa phân loại'}
                    </span>
                    <div className="admin-kiosk-slot-actions">
                      <span>{slot.bouquetId ? 'Đã gán bó hoa' : 'Chưa gán bó hoa'}</span>
                      {slot.zone === 'WALK_IN' && (
                        <Button
                          type="button"
                          variant="outline"
                          aria-label={`Cấu hình cảm biến ô ${slot.slotCode}`}
                          onClick={() => setSensorSlotId(slot.id)}
                        >
                          Cấu hình cảm biến
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {sensorSlot && (
              <AdminSlotSensors
                kioskId={kioskId}
                slotId={sensorSlot.id}
                slotCode={sensorSlot.slotCode}
                onClose={closeSensors}
              />
            )}
          </section>
        )}
      </div>
    </div>
  );
}
