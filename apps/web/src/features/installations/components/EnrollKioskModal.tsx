import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button, CircleAlert } from '@florabot/ui';
import { ApiError, queryClient, request, type Session } from '@/shared/lib/api';
import { Modal } from '../../../shared/components/Modal';
import { KIOSK_REGIONS } from '../installations.constants';
import type { EnrollKioskRequest, EnrollKioskResponse } from '../installations.types';
import { validateEnrollKioskForm } from '../installations.utils';

interface EnrollKioskModalProps {
  open: boolean;
  onClose: () => void;
  session: Session;
  initialSlotCount?: number;
  onSuccess: (created: EnrollKioskResponse) => void;
}

interface EnrollKioskFormProps {
  session: Session;
  onClose: () => void;
  initialSlotCount: number;
  onSuccess: (created: EnrollKioskResponse) => void;
}

function EnrollKioskForm({ session, onClose, initialSlotCount, onSuccess }: EnrollKioskFormProps) {
  const [newKioskCode, setNewKioskCode] = useState('');
  const [newKioskName, setNewKioskName] = useState('');
  const [newHardwareId, setNewHardwareId] = useState('');
  const [newMqttClientId, setNewMqttClientId] = useState('');
  const [newRegion, setNewRegion] = useState('HCM');
  const [slotCount, setSlotCount] = useState(initialSlotCount);
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

    enrollKioskMutation.mutate({
      code: newKioskCode.trim(),
      name: newKioskName.trim(),
      hardwareId: newHardwareId.trim(),
      mqttClientId: newMqttClientId.trim() || null,
      region: newRegion,
      slotCount,
    });
  };

  return (
    <form className="installation-enroll-form" onSubmit={handleSubmit}>
      <div className="status-notice notice-info">
        <CircleAlert size={16} aria-hidden="true" />
        <p>
          Tủ mới có trạng thái <strong>OFFLINE</strong> và có thể được phân công lắp đặt. Khóa thiết
          bị chỉ hiển thị một lần sau khi lưu; hãy giữ lại để cấu hình phần cứng.
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
          placeholder="Để trống nếu chưa dùng MQTT"
        />
        <p className="quiet">Nhập Client ID thật của thiết bị nếu đã cấu hình MQTT.</p>
      </div>

      <div className="kiosk-form-field">
        <label htmlFor="new-slot-count">Tổng số ô tủ (1–50)</label>
        <input
          id="new-slot-count"
          type="number"
          min={1}
          max={50}
          step={1}
          value={slotCount}
          onChange={(e) => setSlotCount(Number(e.target.value))}
          required
        />
        <p className="quiet">
          Chủ shop chọn hình thức bán cho từng ô trống sau khi được cấp kiosk.
        </p>
      </div>

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
  initialSlotCount = 1,
  onSuccess,
}: EnrollKioskModalProps) {
  return (
    <Modal
      open={open}
      title="Đăng ký thiết bị kiosk mới"
      onClose={onClose}
      description="Nhập thông tin trên thiết bị để đưa tủ vào kho khả dụng."
      className="installation-modal"
      size="lg"
    >
      {open && (
        <EnrollKioskForm
          session={session}
          onClose={onClose}
          initialSlotCount={initialSlotCount}
          onSuccess={onSuccess}
        />
      )}
    </Modal>
  );
}
