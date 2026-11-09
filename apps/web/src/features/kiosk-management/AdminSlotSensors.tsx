import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@florabot/ui';
import { Modal } from '@/shared/components/Modal';
import { request } from '@/shared/lib/api';
import type { components } from '../../../../../packages/contracts/src/generated/api';

type Configuration = components['schemas']['SlotSensorCapabilityResponse'];
type SensorSettings = components['schemas']['UpdateSensorCapabilityRequest'];

const initialSettings: SensorSettings = {
  enabled: false,
  doorVerified: false,
  presenceVerified: false,
};

export function AdminSlotSensors({
  kioskId,
  slotId,
  slotCode,
  onClose,
}: {
  kioskId: string;
  slotId: string;
  slotCode: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const path = `/admin/kiosks/${kioskId}/slots/${slotId}/sensor-capabilities`;
  const queryKey = ['admin-slot-sensors', kioskId, slotId];
  const configuration = useQuery({
    queryKey,
    queryFn: async () => (await request<Configuration | undefined>(path)) ?? null,
    staleTime: 0,
  });
  const [draft, setDraft] = useState<SensorSettings | null>(null);
  const saved = configuration.data ?? initialSettings;
  const values = draft ?? saved;
  const verified = values.doorVerified && values.presenceVerified;
  const changed =
    values.enabled !== saved.enabled ||
    values.doorVerified !== saved.doorVerified ||
    values.presenceVerified !== saved.presenceVerified;

  const save = useMutation({
    mutationFn: (settings: SensorSettings) => request<Configuration>(path, settings, true, 'PUT'),
    onSuccess: (result) => {
      queryClient.setQueryData(queryKey, result);
      setDraft(null);
      void queryClient.invalidateQueries({ queryKey: ['seller-kiosk-slots'] });
    },
  });
  const canSave =
    configuration.isSuccess &&
    !configuration.isFetching &&
    !save.isPending &&
    changed &&
    (!values.enabled || verified);

  function update(field: keyof SensorSettings, checked: boolean) {
    save.reset();
    setDraft({
      enabled: values.enabled,
      doorVerified: values.doorVerified,
      presenceVerified: values.presenceVerified,
      [field]: checked,
    });
  }

  return (
    <Modal
      open
      title={`Cấu hình cảm biến ô ${slotCode}`}
      onClose={onClose}
      closeDisabled={save.isPending}
    >
      {configuration.isPending && <p role="status">Đang tải cấu hình cảm biến…</p>}
      {configuration.isError && (
        <>
          <p role="alert" className="error">
            Chưa đọc được cấu hình cảm biến.
          </p>
          <Button type="button" variant="outline" onClick={() => void configuration.refetch()}>
            Tải lại cấu hình
          </Button>
        </>
      )}
      {configuration.isSuccess && (
        <form
          className="admin-slot-sensor-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (canSave) save.mutate(values);
          }}
        >
          <p>
            <strong>Giám sát hiện tại</strong> · {saved.enabled ? 'Đang bật' : 'Đang tắt'}
          </p>
          <fieldset disabled={save.isPending}>
            <legend>Xác minh phần cứng tại ô</legend>
            <label>
              <input
                type="checkbox"
                checked={values.doorVerified}
                onChange={(event) => update('doorVerified', event.target.checked)}
              />
              Đã kiểm tra cảm biến cửa
            </label>
            <label>
              <input
                type="checkbox"
                checked={values.presenceVerified}
                onChange={(event) => update('presenceVerified', event.target.checked)}
              />
              Đã kiểm tra cảm biến hoa
            </label>
            <label>
              <input
                type="checkbox"
                checked={values.enabled}
                disabled={!verified && !values.enabled}
                onChange={(event) => update('enabled', event.target.checked)}
              />
              Bật giám sát cho ô
            </label>
          </fieldset>
          {!verified && (
            <p className="quiet">
              {values.enabled
                ? 'Tắt giám sát hoặc xác minh đủ hai cảm biến trước khi lưu.'
                : 'Xác minh đủ hai cảm biến để bật giám sát.'}
            </p>
          )}
          {configuration.data?.supportsManualRetry && changed && (
            <p className="quiet">Lưu thay đổi sẽ tắt quyền thử lại lệnh mở cửa đang bật ở ô này.</p>
          )}
          {save.isError && (
            <p role="alert" className="error">
              {save.error.message}
            </p>
          )}
          {save.isSuccess && <p role="status">Đã lưu cấu hình cảm biến.</p>}
          <Button type="submit" disabled={!canSave}>
            {save.isPending ? 'Đang lưu…' : 'Lưu cấu hình'}
          </Button>
        </form>
      )}
    </Modal>
  );
}
