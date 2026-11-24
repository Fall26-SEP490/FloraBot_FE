import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@florabot/ui';
import type { components } from '../../../../../packages/contracts/src/generated/api';
import { request } from '@/shared/lib/api';
import type { SellerSlot } from './slot-state';

export default function SellerSlotSensors({
  kioskId,
  slot,
}: {
  kioskId: string;
  slot: SellerSlot;
}) {
  const queryClient = useQueryClient();
  const [doorVerified, setDoorVerified] = useState(false);
  const [presenceVerified, setPresenceVerified] = useState(false);
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

  return (
    <details>
      <summary>
        Cảm biến ô tủ · {slot.sensorEnabled || enable.isSuccess ? 'Đang bật' : 'Chưa bật'}
      </summary>
      {enable.isSuccess && <p role="status">Đã bật giám sát cảm biến cho ô này.</p>}
      {!slot.sensorEnabled && !enable.isSuccess && (
        <form
          className="admin-slot-sensor-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (doorVerified && presenceVerified && !enable.isPending) enable.mutate();
          }}
        >
          <fieldset disabled={enable.isPending}>
            <legend>Xác minh tại ô tủ</legend>
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
          </fieldset>
          {enable.isError && (
            <p role="alert" className="error">
              {enable.error.message}
            </p>
          )}
          <Button type="submit" disabled={!doorVerified || !presenceVerified || enable.isPending}>
            {enable.isPending ? 'Đang bật…' : 'Bật giám sát cảm biến'}
          </Button>
        </form>
      )}
    </details>
  );
}
