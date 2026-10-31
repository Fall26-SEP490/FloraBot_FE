import { useState } from 'react';
import { isValidLatitude, isValidLongitude } from '../../kiosk-location/kiosk-location.utils';

export function useKioskGeolocation(
  onLocationSelect: (lat: number, lon: number) => void,
  currentAddress?: string,
) {
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsMessage, setGpsMessage] = useState('');
  const [gpsError, setGpsError] = useState(false);

  const requestGps = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGpsError(true);
      setGpsMessage('Thiết bị hoặc trình duyệt của bạn không hỗ trợ định vị GPS.');
      return;
    }
    setGpsLoading(true);
    setGpsMessage('');
    setGpsError(false);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsLoading(false);
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        if (isValidLatitude(lat) && isValidLongitude(lon)) {
          onLocationSelect(lat, lon);
          setGpsError(false);
          const hasAddress = Boolean(currentAddress?.trim());
          setGpsMessage(
            hasAddress
              ? 'Đã cập nhật ghim bản đồ theo vị trí hiện tại. Địa chỉ đang chọn được giữ nguyên.'
              : 'Đã cập nhật ghim bản đồ theo vị trí hiện tại. Vui lòng tìm và chọn địa chỉ lắp đặt tương ứng ở ô phía trên.',
          );
        } else {
          setGpsError(true);
          setGpsMessage('Tọa độ GPS nhận được không hợp lệ.');
        }
      },
      (err) => {
        setGpsLoading(false);
        setGpsError(true);
        if (err.code === 1) {
          setGpsMessage(
            'Bạn đã từ chối quyền truy cập vị trí. Vui lòng bật quyền vị trí hoặc chọn trên bản đồ.',
          );
        } else if (err.code === 3) {
          setGpsMessage(
            'Hết thời gian chờ tín hiệu GPS. Vui lòng thử lại hoặc chọn trực tiếp trên bản đồ.',
          );
        } else {
          setGpsMessage(
            'Không thể xác định vị trí hiện tại trên thiết bị này. Vui lòng chọn trên bản đồ.',
          );
        }
      },
      { timeout: 10000, enableHighAccuracy: true },
    );
  };

  return {
    gpsLoading,
    gpsMessage,
    gpsError,
    requestGps,
  };
}
