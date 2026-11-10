import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@florabot/ui';
import { Modal } from '@/shared/components/Modal';
import { request } from '@/shared/lib/api';
import type { components } from '../../../../../packages/contracts/src/generated/api';

type Configuration = components['schemas']['SlotSensorCapabilityResponse'];
type SensorSettings = components['schemas']['UpdateSensorCapabilityRequest'];
type RetrySettings = components['schemas']['ManualUnlockRetryEnrollmentRequest'];

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
  const slotPath = `/admin/kiosks/${kioskId}/slots/${slotId}`;
  const path = `${slotPath}/sensor-capabilities`;
  const queryKey = ['admin-slot-sensors', kioskId, slotId];
  const configuration = useQuery({
    queryKey,
    queryFn: async () => (await request<Configuration | undefined>(path)) ?? null,
    staleTime: 0,
  });
  const [draft, setDraft] = useState<SensorSettings | null>(null);
  const [firmwareVerified, setFirmwareVerified] = useState(false);
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
  const retryAccess = useMutation({
    mutationFn: (settings: RetrySettings) =>
      request<Configuration>(`${slotPath}/manual-unlock-retry`, settings, true, 'PUT'),
    onSuccess: (result) => {
      queryClient.setQueryData(queryKey, result);
      setFirmwareVerified(false);
      void queryClient.invalidateQueries({ queryKey: ['seller-kiosk-slots'] });
    },
  });
  const busy = save.isPending || retryAccess.isPending;
  const retryEnabled = configuration.data?.supportsManualRetry ?? false;
  const canChangeRetry =
    Boolean(configuration.data) &&
    !configuration.isFetching &&
    !busy &&
    !changed &&
    (retryEnabled || (saved.doorVerified && firmwareVerified));
  const canSave =
    configuration.isSuccess &&
    !configuration.isFetching &&
    !busy &&
    changed &&
    (!values.enabled || verified);

  function update(field: keyof SensorSettings, checked: boolean) {
    save.reset();
    retryAccess.reset();
    setFirmwareVerified(false);
    setDraft({
      enabled: values.enabled,
      doorVerified: values.doorVerified,
      presenceVerified: values.presenceVerified,
      [field]: checked,
    });
  }

  return (
    <Modal open title={`Cấu hình cảm biến ô ${slotCode}`} onClose={onClose} closeDisabled={busy}>
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
          <fieldset disabled={busy}>
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
      {configuration.isSuccess && configuration.data && (
        <form
          className="admin-slot-sensor-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (canChangeRetry) {
              save.reset();
              retryAccess.mutate({
                enabled: !retryEnabled,
                firmwareVerified: !retryEnabled && firmwareVerified,
              });
            }
          }}
        >
          <fieldset disabled={busy || changed || configuration.isFetching}>
            <legend>Quyền thử lại lệnh mở cửa</legend>
            <p>Hiện tại: {retryEnabled ? 'Đang bật' : 'Đang tắt'}</p>
            {!retryEnabled && (
              <label>
                <input
                  type="checkbox"
                  checked={firmwareVerified}
                  disabled={!saved.doorVerified}
                  onChange={(event) => {
                    retryAccess.reset();
                    setFirmwareVerified(event.target.checked);
                  }}
                />
                Đã kiểm tra đúng bộ điều khiển và firmware hỗ trợ thử mở lại
              </label>
            )}
            {!retryEnabled && !saved.doorVerified && (
              <p className="quiet">Lưu xác minh cảm biến cửa trước khi bật quyền.</p>
            )}
            {changed && <p className="quiet">Lưu thay đổi cảm biến trước khi cập nhật quyền.</p>}
          </fieldset>
          {retryAccess.isError && (
            <p role="alert" className="error">
              {retryAccess.error.message}
            </p>
          )}
          {retryAccess.isSuccess && (
            <p role="status">{retryEnabled ? 'Đã bật' : 'Đã tắt'} quyền thử mở lại.</p>
          )}
          <Button type="submit" variant="outline" disabled={!canChangeRetry}>
            {retryAccess.isPending
              ? 'Đang cập nhật…'
              : retryEnabled
                ? 'Tắt quyền thử mở lại'
                : 'Bật quyền thử mở lại'}
          </Button>
        </form>
      )}
    </Modal>
  );
}
