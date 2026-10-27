import { useState } from 'react';
import { isValidLatitude, isValidLongitude } from '../../kiosk-location/kiosk-location.utils';

export function useKioskGeolocation(onLocationSelect: (lat: number, lon: number) => void) {
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsMessage, setGpsMessage] = useState('');

  const requestGps = () => {
    if (!navigator.geolocation) {
      setGpsMessage('Trình duyệt không hỗ trợ định vị GPS.');
      return;
    }
    setGpsLoading(true);
    setGpsMessage('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsLoading(false);
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        if (isValidLatitude(lat) && isValidLongitude(lon)) {
          onLocationSelect(lat, lon);
          setGpsMessage('Đã lấy tọa độ hiện tại.');
        } else {
          setGpsMessage('Tọa độ nhận được không hợp lệ.');
        }
      },
      (err) => {
        setGpsLoading(false);
        setGpsMessage(
          err.code === 1
            ? 'Bạn đã từ chối quyền truy cập vị trí.'
            : 'Không thể xác định vị trí hiện tại. Bạn có thể chọn trên bản đồ hoặc nhập tay.',
        );
      },
      { timeout: 10000, enableHighAccuracy: true },
    );
  };

  return {
    gpsLoading,
    gpsMessage,
    requestGps,
  };
}
