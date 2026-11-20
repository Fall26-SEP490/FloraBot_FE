import WorkspaceTable from '@/features/portal/components/WorkspaceTable';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@florabot/ui';
import { request } from '@/shared/lib/api';
import type { components } from '../../../../../../packages/contracts/src/generated/api';
import { TASK_DETAIL_STATES } from '../task-management.constants';
import { formatTaskDate } from '../task-management.utils';

type Health = components['schemas']['TechnicianTaskTelemetry'];

const cycles: Record<string, string> = {
  NONE: 'Chưa ghi nhận thao tác từ khi thiết bị khởi động',
  RELAY_PULSED: 'Đã kích relay, đang chờ tín hiệu mở cửa',
  OPEN_DETECTED: 'Đã nhận tín hiệu mở, đang chờ cửa đóng',
  CLOSE_DETECTED: 'Đã nhận tín hiệu mở và đóng',
  OPEN_TIMEOUT: 'Đã kích relay, hết thời gian chờ tín hiệu mở',
  CLOSE_TIMEOUT: 'Đã nhận tín hiệu mở, hết thời gian chờ tín hiệu đóng',
  INSPECTION_REQUIRED: 'Cần kiểm tra cửa tại tủ',
};

export default function TechnicianIoTHealth({
  path,
  actorId,
  wholeKiosk = false,
}: {
  path: string;
  actorId?: string;
  wholeKiosk?: boolean;
}) {
  const query = useQuery({
    queryKey: ['technician-iot-health', path, actorId],
    queryFn: () => request<Health>(path),
    refetchInterval: 5_000,
    retry: false,
  });
  const data = query.data;
  const fresh = data?.isFresh === true && query.fetchStatus !== 'paused';
  return (
    <section aria-label="Sức khỏe thiết bị IoT">
      {wholeKiosk ? <h2>Tình trạng thiết bị</h2> : <h4>Sức khỏe thiết bị IoT</h4>}
      {query.isPending && <p role="status">Đang đọc tín hiệu từ tủ…</p>}
      {query.isError && <p role="alert">Chưa tải được dữ liệu IoT. Hãy thử đọc lại.</p>}
      {data && !query.isError && (
        <>
          <p>
            {TASK_DETAIL_STATES[data.kioskStatus] ?? data.kioskStatus}
            {' · '}
            {data.observedAt
              ? `Lần đo gần nhất ${formatTaskDate(data.observedAt)}`
              : 'Chưa nhận được bản đo từ tủ'}
          </p>
          {wholeKiosk && (
            <p>
              Heartbeat gần nhất{' '}
              {data.lastHeartbeatAt ? formatTaskDate(data.lastHeartbeatAt) : 'chưa ghi nhận'}
            </p>
          )}
          {!fresh && <p>Đang chờ dữ liệu mới. Trạng thái từng ô chưa xác định.</p>}
          {data.slots?.length === 0 && <p>Chưa có ô tủ để kiểm tra.</p>}
          {!!data.slots?.length && (
            <WorkspaceTable label="Tín hiệu từng ô tủ">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Ô tủ</th>
                    <th scope="col">Cảm biến hoa</th>
                    <th scope="col">Cảm biến cửa</th>
                    <th scope="col">Thao tác cửa gần nhất</th>
                  </tr>
                </thead>
                <tbody>
                  {data.slots.map((slot) => (
                    <tr key={slot.slotCode}>
                      <td>
                        <strong>{slot.slotCode}</strong>
                      </td>
                      <td>
                        {!fresh || slot.flowerDetected == null
                          ? 'Chưa xác định'
                          : slot.flowerDetected
                            ? 'Phát hiện vật'
                            : 'Không phát hiện vật'}
                      </td>
                      <td>
                        {!fresh || slot.doorClosed == null
                          ? 'Chưa xác định'
                          : slot.doorClosed
                            ? 'Báo cửa đóng'
                            : 'Báo cửa mở'}
                      </td>
                      <td>
                        {fresh && slot.lastCycle
                          ? (cycles[slot.lastCycle] ?? 'Chưa xác định')
                          : 'Chưa xác định'}
                        {fresh && slot.lastCycleAt && (
                          <span className="table-secondary">
                            {formatTaskDate(slot.lastCycleAt)}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </WorkspaceTable>
          )}
          <p className="quiet">
            Tín hiệu cảm biến cần đối chiếu tại tủ; chưa có đo dòng khóa điện.
          </p>
        </>
      )}
      <Button
        type="button"
        variant="outline"
        disabled={query.isFetching}
        onClick={() => void query.refetch()}
      >
        Đọc lại tín hiệu
      </Button>
    </section>
  );
}
