import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@florabot/ui';
import { queryClient, request } from '@/shared/lib/api';

export default function SlotZoneSelector({
  kioskId,
  slotId,
  slotCode,
  zone,
  canEdit,
}: {
  kioskId: string;
  slotId: string;
  slotCode: string;
  zone: string | null | undefined;
  canEdit: boolean;
}) {
  const [choice, setChoice] = useState('');
  const update = useMutation({
    mutationFn: (value: string) =>
      request(`/me/kiosks/${kioskId}/slots/${slotId}/zone`, { zone: value }, true, 'PUT'),
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['seller-kiosk-slots'] }),
        queryClient.invalidateQueries({ queryKey: ['staff-preorders'] }),
        queryClient.invalidateQueries({ queryKey: ['staff-stock'] }),
      ]);
      setChoice('');
    },
  });

  if (!canEdit && !update.isPending && !update.isSuccess && !update.isError) {
    return null;
  }

  return (
    <div className="slot-zone-settings">
      {(canEdit || update.isPending) && (
        <>
          <label htmlFor={`slot-zone-${slotId}`}>Hình thức bán cho ô {slotCode}</label>
          <div className="slot-zone-row">
            <select
              id={`slot-zone-${slotId}`}
              value={choice || zone || ''}
              disabled={!canEdit || update.isPending}
              onChange={(event) => {
                setChoice(event.target.value);
                update.reset();
              }}
            >
              <option value="" disabled>
                Chưa phân loại
              </option>
              <option value="WALK_IN">Walk-in</option>
              <option value="PREORDER">Pre-order</option>
            </select>
            {canEdit ? (
              <Button
                type="button"
                disabled={update.isPending || !choice || choice === zone}
                onClick={() => update.mutate(choice)}
              >
                {update.isPending ? 'Đang lưu…' : 'Lưu hình thức bán'}
              </Button>
            ) : null}
          </div>
        </>
      )}
      {update.isSuccess && <p role="status">Đã cập nhật hình thức bán của ô {slotCode}.</p>}
      {update.isError && (
        <p role="alert">
          {update.error.message} Đã tải lại trạng thái ô; kiểm tra trước khi thử lại.
        </p>
      )}
    </div>
  );
}
