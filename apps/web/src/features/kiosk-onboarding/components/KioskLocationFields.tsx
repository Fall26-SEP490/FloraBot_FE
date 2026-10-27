import { Button, MapPin } from '@florabot/ui';
import KioskPickerMap from '../../kiosk-location/components/KioskPickerMap';

interface KioskLocationFieldsProps {
  installationAddress: string;
  onAddressChange: (val: string) => void;
  addressError?: string;
  latitude: number | null;
  longitude: number | null;
  latInput: string;
  lonInput: string;
  onLocationSelect: (lat: number, lon: number) => void;
  onLatInputChange: (val: string) => void;
  onLonInputChange: (val: string) => void;
  coordinatesError?: string;
  gpsLoading: boolean;
  gpsMessage: string;
  onRequestGps: () => void;
}

export function KioskLocationFields({
  installationAddress,
  onAddressChange,
  addressError,
  latitude,
  longitude,
  latInput,
  lonInput,
  onLocationSelect,
  onLatInputChange,
  onLonInputChange,
  coordinatesError,
  gpsLoading,
  gpsMessage,
  onRequestGps,
}: KioskLocationFieldsProps) {
  return (
    <fieldset className="kiosk-form-group">
      <legend>Vị trí & Địa chỉ đề xuất đặt kiosk</legend>

      <div className="kiosk-form-field">
        <label htmlFor="installation-address-input">
          Địa chỉ lắp đặt cụ thể <span className="required-star">*</span>
        </label>
        <input
          id="installation-address-input"
          type="text"
          maxLength={200}
          value={installationAddress}
          onChange={(e) => onAddressChange(e.target.value)}
          placeholder="Số nhà, tên đường, phường/xã, quận/huyện, tỉnh/thành..."
          required
          aria-invalid={!!addressError}
          aria-describedby={addressError ? 'address-error' : undefined}
        />
        {addressError && (
          <p id="address-error" className="kiosk-field-error">
            {addressError}
          </p>
        )}
      </div>

      <div className="kiosk-map-picker-block">
        <div className="map-picker-header">
          <div>
            <span className="map-picker-title">Ghim vị trí chính xác trên bản đồ</span>
            <small className="kiosk-field-hint">
              Nhấp vào bản đồ để chọn tọa độ, hoặc dùng nút định vị GPS bên dưới.
            </small>
          </div>
          <Button
            type="button"
            variant="outline"
            className="gps-btn"
            onClick={onRequestGps}
            disabled={gpsLoading}
          >
            <MapPin size={18} aria-hidden="true" />
            {gpsLoading ? 'Đang dò GPS...' : 'Lấy vị trí hiện tại (GPS)'}
          </Button>
        </div>

        {gpsMessage && (
          <p className="kiosk-gps-notice" role="status">
            {gpsMessage}
          </p>
        )}

        <div className="kiosk-picker-embed">
          <KioskPickerMap
            latitude={latitude}
            longitude={longitude}
            onLocationSelect={onLocationSelect}
            interactive={true}
            ariaLabel="Bản đồ chọn tọa độ lắp đặt kiosk"
          />
        </div>

        {/* Manual Coordinate Fallback (Blank is NOT 0) */}
        <div className="manual-coords-row">
          <div className="kiosk-form-field">
            <label htmlFor="lat-input">Vĩ độ (Latitude)</label>
            <input
              id="lat-input"
              type="text"
              inputMode="decimal"
              value={latInput}
              onChange={(e) => onLatInputChange(e.target.value)}
              placeholder="Ví dụ: 10.776889"
            />
          </div>
          <div className="kiosk-form-field">
            <label htmlFor="lon-input">Kinh độ (Longitude)</label>
            <input
              id="lon-input"
              type="text"
              inputMode="decimal"
              value={lonInput}
              onChange={(e) => onLonInputChange(e.target.value)}
              placeholder="Ví dụ: 106.700806"
            />
          </div>
        </div>
        {coordinatesError && (
          <p role="alert" className="kiosk-field-error">
            {coordinatesError}
          </p>
        )}
      </div>
    </fieldset>
  );
}
