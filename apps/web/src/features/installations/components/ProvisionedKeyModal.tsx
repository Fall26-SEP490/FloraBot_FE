import { useState } from 'react';
import { Button, Check, CircleAlert } from '@florabot/ui';
import { Modal } from '../../../shared/components/Modal';
import type { ProvisionedKeyInfo } from '../installations.types';

interface ProvisionedKeyModalProps {
  info: ProvisionedKeyInfo | null;
  onClose: () => void;
}

export function ProvisionedKeyModal({ info, onClose }: ProvisionedKeyModalProps) {
  const [copySuccess, setCopySuccess] = useState('');

  if (!info) return null;

  const handleClose = () => {
    setCopySuccess('');
    onClose();
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(
        JSON.stringify(
          {
            kioskId: info.kioskId,
            kioskCode: info.code,
            apiKey: info.apiKey,
          },
          null,
          2,
        ),
      );
      setCopySuccess('Đã sao chép cấu hình JSON vào bộ nhớ tạm!');
    } catch {
      setCopySuccess('Không sao chép được. Hãy chọn và sao chép khóa trong ô phía trên.');
    }
  };

  return (
    <Modal
      open={!!info}
      title="Cấu hình khóa thiết bị Kiosk (API Key)"
      onClose={handleClose}
      className="installation-modal"
    >
      <div className="status-notice notice-info">
        <CircleAlert size={18} aria-hidden="true" />
        <div>
          <p>
            <strong>Lưu ý bảo mật quan trọng:</strong> Khóa API này chỉ hiển thị{' '}
            <strong>duy nhất một lần</strong>. Máy chủ chỉ lưu bản băm SHA-256 để xác thực. Hãy sao
            chép và cấu hình vào firmware thiết bị ngay. Sau khi đóng bảng này, khóa sẽ không thể
            xem lại.
          </p>
        </div>
      </div>

      <div className="kiosk-provision-panel">
        <div className="provision-field-row">
          <span>Mã tủ:</span>
          <strong>{info.code}</strong>
        </div>
        <div className="provision-field-row">
          <span>Kiosk ID:</span>
          <code>{info.kioskId}</code>
        </div>
        <div className="kiosk-form-field">
          <label htmlFor="device-api-key-input">Khóa bí mật thiết bị (Device API Key):</label>
          <input
            id="device-api-key-input"
            type="text"
            readOnly
            value={info.apiKey}
            style={{ fontFamily: 'monospace', fontWeight: 600, background: '#f8faf6' }}
          />
        </div>

        <div className="action-buttons-row">
          <Button onClick={() => void handleCopy()}>
            <Check size={18} aria-hidden="true" />
            Sao chép cấu hình JSON
          </Button>
        </div>
        {copySuccess && (
          <p
            role="status"
            className="kiosk-field-hint"
            style={{ color: '#237804', marginTop: '0.5rem' }}
          >
            {copySuccess}
          </p>
        )}
      </div>

      <div className="kiosk-modal-actions">
        <Button onClick={handleClose}>Tôi đã sao chép khóa - Đóng bảng này</Button>
      </div>
    </Modal>
  );
}
