import { useEffect, useState } from 'react';

export type MaintenanceAccess = { id: string; code: string; expiresAt: string };

export function useMaintenanceCode(access: MaintenanceAccess | undefined) {
  const [expired, setExpired] = useState<MaintenanceAccess>();
  useEffect(() => {
    if (!access) return;
    const timer = window.setTimeout(
      () => setExpired(access),
      Math.max(0, Date.parse(access.expiresAt) - Date.now()),
    );
    return () => window.clearTimeout(timer);
  }, [access]);
  return access && access !== expired ? access : undefined;
}

export function MaintenanceCode({ access }: { access: MaintenanceAccess }) {
  return (
    <p role="status">
      Chọn “Nhập mã thao tác tủ” trên màn hình kiosk rồi nhập mã <strong>{access.code}</strong>. Mã
      hết hạn lúc{' '}
      <time dateTime={access.expiresAt}>
        {new Date(access.expiresAt).toLocaleTimeString('vi-VN')}
      </time>
      .
    </p>
  );
}
