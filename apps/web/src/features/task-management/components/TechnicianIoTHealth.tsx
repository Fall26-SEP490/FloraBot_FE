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
  taskId,
  actorId,
}: {
  taskId: string;
  actorId?: string;
}) {
  const query = useQuery({
    queryKey: ['technician-iot-health', taskId, actorId],
    queryFn: () => request<Health>(`/staff/tasks/${taskId}/iot-health`),
    refetchInterval: 5_000,
    retry: false,
  });
  const data = query.data;
  const fresh = data?.isFresh === true && query.fetchStatus !== 'paused';
  return (
    <section aria-label="Sức khỏe thiết bị IoT">
      <h4>Sức khỏe thiết bị IoT</h4>
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
          {!fresh && <p>Đang chờ dữ liệu mới. Trạng thái từng ô chưa xác định.</p>}
          {data.slots?.length === 0 && <p>Công việc này chưa có ô để kiểm tra.</p>}
          {data.slots?.map((slot) => (
            <div key={slot.slotCode}>
              <h5>Ô {slot.slotCode}</h5>
              <dl className="account-details">
                <div>
                  <dt>LM393 · Cảm biến hoa</dt>
                  <dd>
                    {!fresh || slot.flowerDetected == null
                      ? 'Chưa xác định'
                      : slot.flowerDetected
                        ? 'Phát hiện vật'
                        : 'Không phát hiện vật'}
                  </dd>
                </div>
                <div>
                  <dt>MC-38 · Cảm biến cửa</dt>
                  <dd>
                    {!fresh || slot.doorClosed == null
                      ? 'Chưa xác định'
                      : slot.doorClosed
                        ? 'Báo cửa đóng'
                        : 'Báo cửa mở'}
                  </dd>
                </div>
                <div>
                  <dt>Lần thao tác cửa gần nhất</dt>
                  <dd>
                    {fresh && slot.lastCycle
                      ? (cycles[slot.lastCycle] ?? 'Chưa xác định')
                      : 'Chưa xác định'}
                    {fresh && slot.lastCycleAt && ` · ${formatTaskDate(slot.lastCycleAt)}`}
                  </dd>
                </div>
              </dl>
            </div>
          ))}
          <p className="quiet">
            Nếu tín hiệu không khớp thực tế, hãy kiểm tra dây cảm biến, nam châm, nguồn khóa và cơ
            cấu chốt tại ô. Tủ hiện chưa đo dòng qua khóa điện.
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
