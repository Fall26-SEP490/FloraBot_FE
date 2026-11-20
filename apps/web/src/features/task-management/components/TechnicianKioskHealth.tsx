import Select from '@/shared/components/Select';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@florabot/ui';
import { request } from '@/shared/lib/api';
import type { components } from '../../../../../../packages/contracts/src/generated/api';
import TechnicianIoTHealth from './TechnicianIoTHealth';
import '../technician-kiosk-health.css';

type Kiosk = components['schemas']['TechnicianKioskHealthSummary'];

export default function TechnicianKioskHealth({ actorId }: { actorId: string }) {
  const [selected, setSelected] = useState<string>();
  const kiosks = useQuery({
    queryKey: ['technician-kiosk-health-list', actorId],
    queryFn: () => request<Kiosk[]>('/staff/kiosk-health'),
    refetchInterval: 30_000,
    retry: false,
  });
  const kiosk = kiosks.data?.find((item) => item.id === selected) ?? kiosks.data?.[0];
  return (
    <div className="technician-kiosk-health">
      <div className="dashboard-page-heading">
        <h1>Sức khỏe kiosk</h1>
      </div>
      {kiosks.isPending ? (
        <p role="status">Đang tải kiosk được giao…</p>
      ) : kiosks.isError ? (
        <>
          <p role="alert">Chưa tải được danh sách kiosk.</p>
          <Button variant="outline" onClick={() => void kiosks.refetch()}>
            Tải lại
          </Button>
        </>
      ) : kiosk ? (
        <>
          <label htmlFor="technician-health-kiosk">Kiosk được giao</label>
          <Select
            id="technician-health-kiosk"
            value={kiosk.id}
            onChange={(event) => setSelected(event.target.value)}
          >
            {kiosks.data?.map((item) => (
              <option key={item.id} value={item.id}>
                {item.code} · {item.name}
              </option>
            ))}
          </Select>
          <TechnicianIoTHealth
            key={kiosk.id}
            path={`/staff/kiosk-health/${kiosk.id}`}
            actorId={actorId}
            wholeKiosk
          />
        </>
      ) : (
        <p>Chưa có kiosk trong công việc sửa chữa hoặc hồ sơ lắp đặt được giao.</p>
      )}
    </div>
  );
}
