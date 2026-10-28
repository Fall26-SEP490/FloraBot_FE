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
  initialWalkInSlots?: number;
  initialPreorderSlots?: number;
  onSuccess: (created: EnrollKioskResponse) => void;
}

interface EnrollKioskFormProps {
  session: Session;
  onClose: () => void;
  initialWalkInSlots: number;
  initialPreorderSlots: number;
  onSuccess: (created: EnrollKioskResponse) => void;
}

function EnrollKioskForm({
  session,
  onClose,
  initialWalkInSlots,
  initialPreorderSlots,
  onSuccess,
}: EnrollKioskFormProps) {
  const [newKioskCode, setNewKioskCode] = useState('');
  const [newKioskName, setNewKioskName] = useState('');
  const [newHardwareId, setNewHardwareId] = useState('');
  const [newMqttClientId, setNewMqttClientId] = useState('');
  const [newRegion, setNewRegion] = useState('HCM');
  const [newWalkInSlots, setNewWalkInSlots] = useState(initialWalkInSlots);
  const [newPreorderSlots, setNewPreorderSlots] = useState(initialPreorderSlots);
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
      walkInSlots: newWalkInSlots,
      preorderSlots: newPreorderSlots,
    });
    if (!validation.valid) {
      setEnrollError(validation.error || 'Dữ liệu không hợp lệ.');
      return;
    }

    enrollKioskMutation.mutate({
      code: newKioskCode.trim(),
      name: newKioskName.trim(),
      hardwareId: newHardwareId.trim(),
      mqttClientId: newMqttClientId.trim() || `kiosk-${newKioskCode.trim().toLowerCase()}`,
      region: newRegion,
      walkInSlots: newWalkInSlots,
      preorderSlots: newPreorderSlots,
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="status-notice notice-info">
        <CircleAlert size={16} aria-hidden="true" />
        <p>
          Thiết bị được tạo với trạng thái ban đầu là <strong>OFFLINE</strong>. Hệ thống không tạo
          cảm biến hay nhịp tim giả lập. Khóa API thiết bị sẽ được cấp một lần duy nhất sau khi lưu.
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

      <div className="form-fields-grid-2">
        <div className="kiosk-form-field">
          <label htmlFor="new-walkin-slots">Số ô vãng lai (Walk-in)</label>
          <input
            id="new-walkin-slots"
            type="number"
            min={1}
            max={49}
            value={newWalkInSlots}
            onChange={(e) => setNewWalkInSlots(Number(e.target.value))}
            required
          />
        </div>
        <div className="kiosk-form-field">
          <label htmlFor="new-preorder-slots">Số ô đặt trước (Pre-order)</label>
          <input
            id="new-preorder-slots"
            type="number"
            min={1}
            max={49}
            value={newPreorderSlots}
            onChange={(e) => setNewPreorderSlots(Number(e.target.value))}
            required
          />
        </div>
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
  initialWalkInSlots = 1,
  initialPreorderSlots = 1,
  onSuccess,
}: EnrollKioskModalProps) {
  return (
    <Modal open={open} title="Đăng ký thiết bị kiosk mới" onClose={onClose}>
      {open && (
        <EnrollKioskForm
          session={session}
          onClose={onClose}
          initialWalkInSlots={initialWalkInSlots}
          initialPreorderSlots={initialPreorderSlots}
          onSuccess={onSuccess}
        />
      )}
    </Modal>
  );
}
