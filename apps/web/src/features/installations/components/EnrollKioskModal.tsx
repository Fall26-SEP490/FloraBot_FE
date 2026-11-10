import { ApplicationRentalSummary } from '../../kiosk-pricing/ApplicationRentalSummary';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button, CircleAlert } from '@florabot/ui';
import { ApiError, queryClient, request, type Session } from '@/shared/lib/api';
import { Modal } from '../../../shared/components/Modal';
import { KIOSK_REGIONS } from '../installations.constants';
import type {
  EnrollKioskRequest,
  EnrollKioskResponse,
  KioskApplicationResponse,
} from '../installations.types';
import { validateEnrollKioskForm } from '../installations.utils';

interface EnrollKioskModalProps {
  open: boolean;
  onClose: () => void;
  session: Session;
  application: KioskApplicationResponse | null;
  onSuccess: (created: EnrollKioskResponse) => void;
}

interface EnrollKioskFormProps {
  session: Session;
  onClose: () => void;
  application: KioskApplicationResponse;
  onSuccess: (created: EnrollKioskResponse) => void;
}

function EnrollKioskForm({ session, onClose, application, onSuccess }: EnrollKioskFormProps) {
  const [newKioskCode, setNewKioskCode] = useState('');
  const [newKioskName, setNewKioskName] = useState('');
  const [newHardwareId, setNewHardwareId] = useState('');
  const [newMqttClientId, setNewMqttClientId] = useState('');
  const [newRegion, setNewRegion] = useState('HCM');
  const slotCount = Number(application.totalSlots);
  const [enrollError, setEnrollError] = useState('');

  const enrollKioskMutation = useMutation({
    mutationFn: (data: EnrollKioskRequest) =>
      request<EnrollKioskResponse>('/operations/kiosks/enroll', data),
    onSuccess: (created) => {
      setNewKioskCode('');
      setNewKioskName('');
      setNewHardwareId('');
      setNewMqttClientId('');
      setEnrollError('');
      void queryClient.invalidateQueries({ queryKey: ['eligible-kiosks', session.id] });
      void queryClient.invalidateQueries({ queryKey: ['available-kiosks-inventory', session.id] });
      onSuccess(created);
    },
    onError: (err) => {
      setEnrollError(err instanceof ApiError ? err.message : 'Chưa thêm được thiết bị kiosk.');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (enrollKioskMutation.isPending) return;
    const validation = validateEnrollKioskForm({
      code: newKioskCode,
      name: newKioskName,
      hardwareId: newHardwareId,
      slotCount,
    });
    if (!validation.valid) {
      setEnrollError(validation.error || 'Dữ liệu không hợp lệ.');
      return;
    }

    if (application.status !== 'CONFIRMED') {
      setEnrollError('Chỉ tạo tủ cho hồ sơ đã thanh toán và xác nhận.');
      return;
    }
    enrollKioskMutation.mutate({
      applicationId: application.id,
      code: newKioskCode.trim(),
      name: newKioskName.trim(),
      hardwareId: newHardwareId.trim(),
      mqttClientId: newMqttClientId.trim() || null,
      region: newRegion,
    });
  };

  return (
    <form className="installation-enroll-form" onSubmit={handleSubmit}>
      <div className="status-notice notice-info">
        <CircleAlert size={16} aria-hidden="true" />
        <p>
          Tủ mới ở trạng thái <strong>OFFLINE</strong>. Sau khi đăng ký, mở Cấu hình ESP32 để theo
          dõi tiến độ. Khóa API cho màn hình kiosk chỉ hiển thị một lần sau khi lưu.
        </p>
      </div>

      {enrollError && (
        <p role="alert" className="kiosk-field-error">
          {enrollError}
        </p>
      )}

      <div className="form-fields-grid-2">
        <div className="kiosk-form-field">
          <label htmlFor="new-kiosk-code">Mã tủ (Code) *</label>
          <input
            id="new-kiosk-code"
            type="text"
            value={newKioskCode}
            onChange={(e) => setNewKioskCode(e.target.value)}
            placeholder="K-HCM-03"
            required
          />
        </div>
        <div className="kiosk-form-field">
          <label htmlFor="new-kiosk-name">Tên tủ *</label>
          <input
            id="new-kiosk-name"
            type="text"
            value={newKioskName}
            onChange={(e) => setNewKioskName(e.target.value)}
            placeholder="Kiosk Bình Thạnh"
            required
          />
        </div>
      </div>

      <div className="form-fields-grid-2">
        <div className="kiosk-form-field">
          <label htmlFor="new-hardware-id">Hardware ID (Serial) *</label>
          <input
            id="new-hardware-id"
            type="text"
            value={newHardwareId}
            onChange={(e) => setNewHardwareId(e.target.value)}
            placeholder="ESP32-SN-998811"
            required
          />
        </div>
        <div className="kiosk-form-field">
          <label htmlFor="new-region-select">Khu vực (Region)</label>
          <select
            id="new-region-select"
            value={newRegion}
            onChange={(e) => setNewRegion(e.target.value)}
          >
            {KIOSK_REGIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="kiosk-form-field">
        <label htmlFor="new-mqtt-client-id">MQTT Client ID (nếu có)</label>
        <input
          id="new-mqtt-client-id"
          type="text"
          value={newMqttClientId}
          onChange={(e) => setNewMqttClientId(e.target.value)}
          placeholder="Để trống để hệ thống tự điền nếu đã bật tự cấp"
        />
        <p className="quiet">
          Khi VPS bật tự cấp, Client ID là <code>esp32-{newHardwareId.trim() || 'HardwareId'}</code>
          .
        </p>
      </div>

      <ApplicationRentalSummary application={application} />
      <p>Số ô và loại ô được tạo theo hồ sơ, không thể chỉnh tại bước này.</p>

      <div className="kiosk-modal-actions">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={enrollKioskMutation.isPending}
        >
          Hủy
        </Button>
        <Button type="submit" disabled={enrollKioskMutation.isPending}>
          {enrollKioskMutation.isPending ? 'Đang thêm...' : 'Đăng ký thiết bị (OFFLINE)'}
        </Button>
      </div>
    </form>
  );
}

export function EnrollKioskModal({
  open,
  onClose,
  session,
  application,
  onSuccess,
}: EnrollKioskModalProps) {
  return (
    <Modal
      open={open}
      title="Đăng ký thiết bị kiosk mới"
      onClose={onClose}
      description="Tạo thiết bị theo số ô và phân bổ đã chốt trong hồ sơ thuê."
      className="installation-modal"
      size="lg"
    >
      {open && application && (
        <EnrollKioskForm
          session={session}
          onClose={onClose}
          application={application}
          onSuccess={onSuccess}
        />
      )}
    </Modal>
  );
}
