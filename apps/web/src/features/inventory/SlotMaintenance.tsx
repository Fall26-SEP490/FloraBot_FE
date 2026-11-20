import IconActionButton from '@/shared/components/IconActionButton';
import { useEffect, useState } from 'react';
import { CustomSelect } from '@/shared/components/CustomSelect';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button } from '@florabot/ui';
import { ApiError, queryClient, request } from '@/shared/lib/api';
import { slotMaintenanceProgress, type SellerSlot } from './slot-state';

export type MaintenanceAction = 'LOAD' | 'REMOVE' | 'REPLACE';

export interface MaintenanceSession {
  id: string;
  kioskId: string;
  slotId: string;
  action: MaintenanceAction;
  stage: string;
  substate: string | null;
  currentCmdId: string | null;
  expiresAt: string;
  inspectionReason: string | null;
  availableActions: string[];
  retryAfterSeconds: number | null;
}

export const maintenancePath = (kioskId: string, slotId: string, sessionId?: string) =>
  `/me/kiosks/${kioskId}/slots/${slotId}/maintenance-sessions${sessionId ? `/${sessionId}` : ''}`;

export const maintenanceKey = (sellerId: string, kioskId: string, slotId: string) =>
  `florabot:slot-maintenance:${sellerId}:${kioskId}:${slotId}`;

export async function startMaintenance(input: {
  kioskId: string;
  slot: SellerSlot;
  action: MaintenanceAction;
  productId?: string | null;
  reason: string;
}) {
  return request<MaintenanceSession>(
    '/me/maintenance-open',
    {
      kioskId: input.kioskId,
      slotId: input.slot.id,
      operation: 'START',
      sessionId: crypto.randomUUID(),
      action: input.action,
      expectedBouquetId: input.slot.bouquetId ?? null,
      productId: input.action === 'REMOVE' ? null : input.productId?.trim() || null,
      reason: input.reason.trim(),
    },
    true,
    'POST',
  );
}

const actionLabels: Record<MaintenanceAction, string> = {
  LOAD: 'Nạp hoa',
  REMOVE: 'Thu hồi hoa',
  REPLACE: 'Thay hoa',
};

const stageLabels: Record<string, string> = {
  AwaitRemoval: 'Đang chờ lấy hoa cũ ra',
  AwaitLoading: 'Đang chờ nạp hoa',
  NeedsInspection: 'Cần kiểm tra ô',
  Completed: 'Đã hoàn tất',
  Recovered: 'Đã kết thúc sau kiểm tra',
};

export default function SlotMaintenance({
  sellerId,
  kioskId,
  slot,
  products,
  canStock,
  loadSessionId,
  onLoadFinished,
}: {
  sellerId: string;
  kioskId: string;
  slot: SellerSlot;
  products: { id: string; name: string }[];
  canStock: boolean;
  loadSessionId?: string;
  onLoadFinished: () => void;
}) {
  const [savedSessionId, setSavedSessionId] = useState<string | null>(() => {
    if (loadSessionId) return loadSessionId;
    try {
      return typeof window === 'undefined'
        ? null
        : window.localStorage.getItem(maintenanceKey(sellerId, kioskId, slot.id));
    } catch {
      return null;
    }
  });
  const [action, setAction] = useState<MaintenanceAction>('REMOVE');
  const [productId, setProductId] = useState('');
  const [reason, setReason] = useState('');
  const [issueReason, setIssueReason] = useState('');
  const activeQueryKey = ['slot-maintenance-active', kioskId, slot.id];
  const activeSession = useQuery({
    queryKey: activeQueryKey,
    queryFn: async () =>
      (await request<MaintenanceSession | undefined>(
        `${maintenancePath(kioskId, slot.id)}/active`,
      )) ?? null,
    enabled: !!slot.sensorEnabled && !savedSessionId,
    staleTime: Infinity,
    refetchInterval: (query) =>
      query.state.data?.id ? false : slot.status === 'LOCKED' ? 4_000 : false,
  });
  const sessionId = savedSessionId || activeSession.data?.id || null;
  const session = useQuery({
    queryKey: ['slot-maintenance', kioskId, slot.id, sessionId],
    queryFn: () => request<MaintenanceSession>(maintenancePath(kioskId, slot.id, sessionId!)),
    enabled: !!sessionId,
    refetchInterval: (query) =>
      ['Completed', 'Recovered'].includes(query.state.data?.stage ?? '') ? false : 4_000,
  });
  const current = session.data;
  const sessionClosed = current?.stage === 'Completed' || current?.stage === 'Recovered';
  const sessionExpired =
    current?.stage === 'NeedsInspection' && current.inspectionReason === 'SessionExpired';
  const waitingForDoor =
    current?.substate === 'Initial' &&
    !!current.currentCmdId &&
    (current.stage === 'AwaitRemoval' || current.stage === 'AwaitLoading');
  const progress = current && !sessionClosed ? slotMaintenanceProgress(slot, current) : null;
  useEffect(() => {
    if (!current || sessionClosed) return;
    try {
      window.localStorage.setItem(maintenanceKey(sellerId, kioskId, slot.id), current.id);
    } catch {
      // The active-session API can recover the session without browser storage.
    }
  }, [current, sessionClosed, sellerId, kioskId, slot.id]);

  useEffect(() => {
    if (!sessionClosed) return;
    try {
      window.localStorage.removeItem(maintenanceKey(sellerId, kioskId, slot.id));
    } catch {
      // The closed session is still visible in query state.
    }
    void queryClient.invalidateQueries({ queryKey: ['seller-kiosk-slots', sellerId, kioskId] });
    void queryClient.invalidateQueries({ queryKey: ['products', sellerId] });
  }, [sessionClosed, sellerId, kioskId, slot.id]);

  const start = useMutation({
    mutationFn: () => startMaintenance({ kioskId, slot, action, productId, reason }),
    onSuccess: (result) => {
      queryClient.setQueryData(['slot-maintenance', kioskId, slot.id, result.id], result);
      queryClient.setQueryData(activeQueryKey, result);
      setSavedSessionId(result.id);
      void queryClient.invalidateQueries({ queryKey: ['seller-kiosk-slots', sellerId, kioskId] });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['products', sellerId] }),
  });
  const advance = useMutation({
    mutationFn: ({ step, body }: { step: string; body?: object }) =>
      request<MaintenanceSession>(
        `${maintenancePath(kioskId, slot.id, sessionId!)}/${step}`,
        body ?? {},
        true,
        'POST',
      ),
    onSuccess: (result) => {
      queryClient.setQueryData(['slot-maintenance', kioskId, slot.id, sessionId], result);
      setSavedSessionId(result.id);
      queryClient.setQueryData(
        activeQueryKey,
        result.stage === 'Completed' || result.stage === 'Recovered' ? null : result,
      );
      if (result.stage === 'Completed' || result.stage === 'Recovered') {
        void queryClient.invalidateQueries({ queryKey: ['seller-kiosk-slots', sellerId, kioskId] });
      }
      setIssueReason('');
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['products', sellerId] }),
  });
  const open = useMutation({
    mutationFn: (operation: 'OPEN_NEXT' | 'OPEN_FOR_CHECK' | 'RETRY') =>
      request(
        '/me/maintenance-open',
        {
          kioskId,
          slotId: slot.id,
          sessionId,
          operation,
          action: null,
          expectedBouquetId: null,
          productId: null,
          reason: operation === 'OPEN_FOR_CHECK' ? issueReason.trim() : null,
          ...(operation === 'RETRY' ? { requestId: crypto.randomUUID() } : {}),
        },
        true,
        'POST',
      ),
    onSuccess: async () => {
      await Promise.all([
        session.refetch(),
        queryClient.invalidateQueries({ queryKey: activeQueryKey }),
      ]);
    },
  });

  if (!slot.sensorEnabled) return null;

  const hasStoredSession = !!sessionId;
  const active = current && !sessionClosed;
  const eligibleBouquet = !!slot.bouquetId && ['STOCKED', 'PENDING_REMOVAL'].includes(slot.status);
  const canStart =
    slot.zone === 'WALK_IN' &&
    slot.sensorReady &&
    eligibleBouquet &&
    !hasStoredSession &&
    !activeSession.isPending &&
    !activeSession.isError;
  const busy = start.isPending || advance.isPending || open.isPending;
  const maintenanceError = start.error || advance.error || open.error;
  if (
    !hasStoredSession &&
    !eligibleBouquet &&
    slot.sensorReady &&
    !activeSession.isPending &&
    !activeSession.isError
  )
    return null;

  return (
    <section className="stock-maintenance" aria-label={`Thao tác ô ${slot.slotCode}`}>
      <div className="stock-maintenance-heading">
        <h4>{hasStoredSession ? 'Tiến độ thực hiện' : 'Thu hồi hoặc thay hoa'}</h4>
      </div>
      {open.isSuccess && open.variables === 'RETRY' && (
        <p role="status">Đã gửi yêu cầu thử lại. Chờ tủ phản hồi.</p>
      )}
      {!slot.sensorReady && (
        <p role="note">
          Ô chưa được xác minh đủ cảm biến cửa và hoa. Liên hệ admin để kiểm tra trước khi thao tác.
        </p>
      )}
      {slot.zone !== 'WALK_IN' && (
        <p role="note">
          Quy trình seller tự mở ô để nạp, lấy hoặc thay hoa chỉ áp dụng cho ô Walk-in.
        </p>
      )}
      {!hasStoredSession && slot.sensorReady && !eligibleBouquet && (
        <p className="quiet">
          {slot.status === 'RENTED_EMPTY'
            ? 'Chọn ô và mẫu hoa ở khu nạp hoa để bắt đầu mở cửa.'
            : 'Trạng thái ô hiện tại chưa cho phép bắt đầu thu hồi hoặc thay hoa.'}
        </p>
      )}
      {session.isError && (
        <div role="alert" className="error">
          <p>Chưa tải được tiến độ thao tác: {session.error.message}</p>
          <IconActionButton
            type="button"
            variant="outline"
            onClick={() => void session.refetch()}
            action="reload"
            label="Tải lại phiên"
          />
        </div>
      )}
      {activeSession.isError && !savedSessionId && (
        <p role="alert" className="error">
          Chưa kiểm tra được thao tác đang diễn ra. Tải lại trang trước khi tiếp tục.
        </p>
      )}
      {hasStoredSession && session.isPending && <p role="status">Đang tải tiến độ…</p>}
      {current && (
        <div className="stock-maintenance-progress" role="status">
          <strong>
            {actionLabels[current.action]} ·{' '}
            {sessionExpired
              ? 'Phiên đã hết hạn'
              : (progress?.label ??
                (waitingForDoor
                  ? 'Đang chờ tủ xác nhận mở cửa'
                  : stageLabels[current.stage] || current.stage))}
          </strong>
          <p>
            {current.stage === 'Recovered'
              ? 'Đội vận hành đã đối soát và cập nhật lại trạng thái ô.'
              : sessionExpired
                ? 'Ô vẫn khóa trong hệ thống vì phiên đã hết hạn mà chưa xác nhận được kết quả. Liên hệ đội vận hành để kiểm tra cửa và tình trạng hoa trong ô.'
                : current.stage === 'Completed'
                  ? 'Hệ thống đã xác nhận tín hiệu cửa và cảm biến, đồng thời cập nhật thông tin ô.'
                  : current.stage === 'NeedsInspection'
                    ? `Chưa thể xác nhận kết quả. ${current.inspectionReason || 'Hãy kiểm tra ô và tín hiệu cảm biến.'}`
                    : current.action === 'REPLACE' &&
                        current.substate === 'RemovalClosedEmptyConfirmed'
                      ? 'Hoa cũ đã được lấy ra. Mở cửa lần nữa để đặt hoa mới vào.'
                      : (progress?.key === 'DOOR_OPEN' || slot.doorState === 'CLOSED') && progress
                        ? progress.hint
                        : waitingForDoor
                          ? 'Hệ thống đã tiếp nhận yêu cầu mở ô. Chờ cửa mở thực tế. Nếu cửa vẫn đóng, chọn “Kiểm tra tiến độ”.'
                          : 'Thao tác với hoa thật, đóng cửa ô, rồi chờ tín hiệu cảm biến. Trạng thái sẽ tự cập nhật.'}
          </p>
          {active && (
            <p className="quiet">
              Phiên hết hạn:{' '}
              {new Date(current.expiresAt).toLocaleString('vi-VN', {
                timeZone: 'Asia/Ho_Chi_Minh',
                hour12: false,
              })}
            </p>
          )}
        </div>
      )}
      {active && (
        <div className="stock-maintenance-controls">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => advance.mutate({ step: 'check' })}
          >
            Kiểm tra tiến độ
          </Button>
          {current.availableActions.includes('open-next') && (
            <Button type="button" disabled={busy} onClick={() => open.mutate('OPEN_NEXT')}>
              Mở cửa nạp hoa mới
            </Button>
          )}
          {current.availableActions.includes('open-for-check') && (
            <Button
              type="button"
              variant="outline"
              disabled={busy || issueReason.trim().length < 5}
              onClick={() => open.mutate('OPEN_FOR_CHECK')}
            >
              Mở cửa kiểm tra
            </Button>
          )}
          {slot.manualRetryEnabled &&
            current.currentCmdId &&
            (current.stage === 'AwaitRemoval' || current.stage === 'AwaitLoading') && (
              <Button
                type="button"
                variant="outline"
                disabled={busy || (current.retryAfterSeconds ?? 0) > 0}
                onClick={() => open.mutate('RETRY')}
              >
                Thử lại lệnh mở cửa
              </Button>
            )}
          {(current.availableActions.includes('report-issue') ||
            current.availableActions.includes('open-for-check')) && (
            <div className="stock-maintenance-issue">
              <label htmlFor={`maintenance-issue-${slot.id}`}>Mô tả sự cố</label>
              <textarea
                id={`maintenance-issue-${slot.id}`}
                value={issueReason}
                maxLength={500}
                onChange={(event) => setIssueReason(event.target.value)}
                placeholder="Mô tả tình trạng cửa hoặc cảm biến"
              />
              {current.availableActions.includes('report-issue') && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy || issueReason.trim().length < 5}
                  onClick={() =>
                    advance.mutate({ step: 'report-issue', body: { reason: issueReason.trim() } })
                  }
                >
                  Báo sự cố
                </Button>
              )}
            </div>
          )}
        </div>
      )}
      {sessionClosed && (
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setSavedSessionId(null);
            open.reset();
            onLoadFinished();
            queryClient.setQueryData(['slot-maintenance-active', kioskId, slot.id], null);
          }}
        >
          Đóng tiến độ
        </Button>
      )}
      {!hasStoredSession && canStart && (
        <div className="stock-maintenance-start">
          <p>Chỉ gửi yêu cầu mở ô khi bạn đang ở tủ.</p>
          <label htmlFor={`maintenance-action-${slot.id}`}>Thao tác</label>
          <CustomSelect
            id={`maintenance-action-${slot.id}`}
            value={action}
            onValueChange={(value) => setAction(value as MaintenanceAction)}
            options={[
              { value: 'REMOVE', label: 'Thu hồi hoa' },
              ...(canStock ? [{ value: 'REPLACE', label: 'Thay hoa' }] : []),
            ]}
          />
          {action === 'REPLACE' && (
            <>
              <label htmlFor={`maintenance-product-${slot.id}`}>Mẫu hoa mới</label>
              <CustomSelect
                id={`maintenance-product-${slot.id}`}
                value={productId}
                onValueChange={setProductId}
                options={[
                  { value: '', label: 'Chọn mẫu hoa' },
                  ...products.map((product) => ({ value: product.id, label: product.name })),
                ]}
              />
            </>
          )}
          <label htmlFor={`maintenance-reason-${slot.id}`}>Lý do thao tác</label>
          <textarea
            id={`maintenance-reason-${slot.id}`}
            value={reason}
            maxLength={500}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Nhập lý do, từ 5 ký tự"
          />
          <Button
            type="button"
            disabled={busy || reason.trim().length < 5 || (action === 'REPLACE' && !productId)}
            onClick={() => start.mutate()}
          >
            {start.isPending
              ? 'Đang gửi yêu cầu mở ô…'
              : action === 'REPLACE'
                ? 'Bắt đầu thay hoa'
                : 'Bắt đầu thu hồi hoa'}
          </Button>
        </div>
      )}
      {hasStoredSession && session.isError && (
        <p className="quiet">
          Nếu phiên không còn trên máy chủ, liên hệ hỗ trợ trước khi mở một phiên mới.
        </p>
      )}
      {maintenanceError && (
        <p role="alert" className="error">
          {maintenanceError.message}
          {maintenanceError instanceof ApiError && ` (HTTP ${maintenanceError.status})`}
        </p>
      )}
    </section>
  );
}
