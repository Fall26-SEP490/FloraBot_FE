import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@florabot/ui';
import type { components } from '../../../../../packages/contracts/src/generated/api';
import { Modal } from '@/shared/components/Modal';
import '../dashboard/styles/admin-approvals.css';
import { request } from '@/shared/lib/api';
import type { SellerSlot } from './slot-state';

export default function SellerSlotSensors({
  kioskId,
  slot,
  onClose,
}: {
  kioskId: string;
  slot: SellerSlot;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [doorVerified, setDoorVerified] = useState(false);
  const [presenceVerified, setPresenceVerified] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const verified = doorVerified && presenceVerified;
  const enable = useMutation({
    mutationFn: () =>
      request<components['schemas']['SlotSensorCapabilityResponse']>(
        `/me/kiosks/${kioskId}/slots/${slot.id}/sensor-capabilities`,
        { enabled: true, doorVerified, presenceVerified },
        true,
        'PUT',
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['seller-kiosk-slots'] }),
  });

  const monitoring = slot.sensorEnabled || enable.isSuccess;
  return (
    <Modal
      open
      title={`Cấu hình cảm biến ô ${slot.slotCode}`}
      onClose={onClose}
      closeDisabled={enable.isPending}
    >
      <p>
        <strong>Giám sát hiện tại</strong> · {monitoring ? 'Đang bật' : 'Chưa bật'}
      </p>
      {enable.isSuccess && <p role="status">Đã lưu cấu hình cảm biến.</p>}
      {!monitoring && (
        <form
          className="admin-slot-sensor-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (verified && enabled && !enable.isPending) enable.mutate();
          }}
        >
          <fieldset disabled={enable.isPending}>
            <legend>Xác minh phần cứng tại ô</legend>
            <label>
              <input
                type="checkbox"
                checked={doorVerified}
                onChange={(event) => setDoorVerified(event.target.checked)}
              />
              Đã kiểm tra cảm biến cửa
            </label>
            <label>
              <input
                type="checkbox"
                checked={presenceVerified}
                onChange={(event) => setPresenceVerified(event.target.checked)}
              />
              Đã kiểm tra cảm biến hoa
            </label>
            <label>
              <input
                type="checkbox"
                checked={verified && enabled}
                disabled={!verified}
                onChange={(event) => setEnabled(event.target.checked)}
              />
              Bật giám sát cho ô
            </label>
          </fieldset>
          {!verified && <p className="quiet">Xác minh đủ hai cảm biến để bật giám sát.</p>}
          {enable.isError && (
            <p role="alert" className="error">
              {enable.error.message}
            </p>
          )}
          <Button type="submit" disabled={!verified || !enabled || enable.isPending}>
            {enable.isPending ? 'Đang lưu…' : 'Lưu cấu hình'}
          </Button>
        </form>
      )}
    </Modal>
  );
}
