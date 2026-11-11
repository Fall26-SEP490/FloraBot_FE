import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button } from '@florabot/ui';
import { queryClient, request } from '@/shared/lib/api';
import type { SellerSlot } from './slot-state';
import { MaintenanceCode, useMaintenanceCode, type MaintenanceAccess } from './MaintenanceCode';

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
  return request<MaintenanceAccess>(
    '/me/maintenance-access',
    {
      kioskId: input.kioskId,
      slotId: input.slot.id,
      operation: 'START',
      sessionId: crypto.randomUUID(),
      action: input.action,
      expectedBouquetId: input.slot.bouquetId,
      productId: input.productId ?? null,
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
};

export default function SlotMaintenance({
  sellerId,
  kioskId,
  slot,
  products,
  canStock,
  loadAccess,
  onLoadFinished,
}: {
  sellerId: string;
  kioskId: string;
  slot: SellerSlot;
  products: { id: string; name: string }[];
  canStock: boolean;
  loadAccess?: MaintenanceAccess;
  onLoadFinished: () => void;
}) {
  const [savedSessionId, setSavedSessionId] = useState<string | null>(() => {
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
  const [issued, setIssued] = useState<{
    access: MaintenanceAccess;
    sessionSnapshot: string | null;
  }>();
  const access = useMaintenanceCode(issued?.access ?? loadAccess);

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
      query.state.data?.id ? false : access || slot.status === 'LOCKED' ? 4_000 : false,
  });
  const sessionId = savedSessionId || activeSession.data?.id || null;
  const session = useQuery({
    queryKey: ['slot-maintenance', kioskId, slot.id, sessionId],
    queryFn: () => request<MaintenanceSession>(maintenancePath(kioskId, slot.id, sessionId!)),
    enabled: !!sessionId,
    refetchInterval: (query) => (query.state.data?.stage === 'Completed' ? false : 4_000),
  });
  const current = session.data;
  const sessionSnapshot = current
    ? [current.id, current.stage, current.substate, current.currentCmdId].join(':')
    : null;
  const matchesOperation = issued?.sessionSnapshot
    ? sessionSnapshot === issued.sessionSnapshot
    : !sessionId;
  const visibleCode = matchesOperation ? access : undefined;

  useEffect(() => {
    if (!current || current.stage === 'Completed') return;
    try {
      window.localStorage.setItem(maintenanceKey(sellerId, kioskId, slot.id), current.id);
    } catch {
      // The active-session API can recover the session without browser storage.
    }
  }, [current, sellerId, kioskId, slot.id]);

  useEffect(() => {
    if (session.data?.stage !== 'Completed') return;
    try {
      window.localStorage.removeItem(maintenanceKey(sellerId, kioskId, slot.id));
    } catch {
      // The completed session is still visible in query state.
    }
    void queryClient.invalidateQueries({ queryKey: ['seller-kiosk-slots', sellerId, kioskId] });
    void queryClient.invalidateQueries({ queryKey: ['products', sellerId] });
  }, [session.data?.stage, sellerId, kioskId, slot.id]);

  const start = useMutation({
    mutationFn: () => startMaintenance({ kioskId, slot, action, productId, reason }),
    onSuccess: (result) => {
      setIssued({ access: result, sessionSnapshot: null });
      void activeSession.refetch();
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
      if (result.stage === 'Completed') {
        void queryClient.invalidateQueries({ queryKey: ['seller-kiosk-slots', sellerId, kioskId] });
      }
      setIssueReason('');
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['products', sellerId] }),
  });
  const open = useMutation({
    mutationFn: (operation: 'OPEN_NEXT' | 'OPEN_FOR_CHECK' | 'RETRY') =>
      request<MaintenanceAccess>(
        '/me/maintenance-access',
        {
          kioskId,
          slotId: slot.id,
          sessionId,
          operation,
          ...(operation === 'OPEN_FOR_CHECK' ? { reason: issueReason.trim() } : {}),
          ...(operation === 'RETRY' ? { requestId: crypto.randomUUID() } : {}),
        },
        true,
        'POST',
      ),
    onSuccess: (result) => setIssued({ access: result, sessionSnapshot }),
  });

  if (!slot.sensorEnabled) return null;

  const hasStoredSession = !!sessionId;
  const active = current && current.stage !== 'Completed';
  const eligibleBouquet = !!slot.bouquetId && ['STOCKED', 'PENDING_REMOVAL'].includes(slot.status);
  const canStart =
    slot.zone === 'WALK_IN' &&
    slot.sensorReady &&
    eligibleBouquet &&
    !hasStoredSession &&
    !activeSession.isPending &&
    !activeSession.isError;
  const busy = start.isPending || advance.isPending || open.isPending;

  return (
    <section className="stock-maintenance" aria-label={`Bảo trì ô ${slot.slotCode}`}>
      <div className="stock-maintenance-heading">
        <h4>Bảo trì ô {slot.slotCode}</h4>
        <span className="stock-maintenance-chip">Có giám sát cảm biến</span>
      </div>
      {visibleCode && <MaintenanceCode access={visibleCode} />}
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
          <p>Không tải được phiên bảo trì đã lưu: {session.error.message}</p>
          <Button type="button" variant="outline" onClick={() => void session.refetch()}>
            Tải lại phiên
          </Button>
        </div>
      )}
      {activeSession.isError && !savedSessionId && (
        <p role="alert" className="error">
          Chưa kiểm tra được phiên bảo trì đang mở. Tải lại trang trước khi thao tác.
        </p>
      )}
      {hasStoredSession && session.isPending && <p role="status">Đang tải phiên bảo trì…</p>}
      {current && (
        <div className="stock-maintenance-progress" role="status">
          <strong>
            {actionLabels[current.action]} · {stageLabels[current.stage] || current.stage}
          </strong>
          <p>
            {current.stage === 'Completed'
              ? 'BE đã xác nhận cửa và cảm biến; thông tin ô đã được cập nhật.'
              : current.stage === 'NeedsInspection'
                ? `Chưa thể xác nhận kết quả. ${current.inspectionReason || 'Hãy kiểm tra ô và tín hiệu cảm biến.'}`
                : current.action === 'REPLACE' && current.substate === 'RemovalClosedEmptyConfirmed'
                  ? 'Hoa cũ đã được lấy ra. Mở cửa lần nữa để đặt hoa mới vào.'
                  : 'Thao tác với hoa thật, đóng cửa ô, rồi chờ tín hiệu cảm biến. Trạng thái sẽ tự cập nhật.'}
          </p>
          {active && (
            <p className="quiet">
              Phiên hết hạn: {new Date(current.expiresAt).toLocaleString('vi-VN')}
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
            <Button
              type="button"
              disabled={busy || !!visibleCode}
              onClick={() => open.mutate('OPEN_NEXT')}
            >
              Mở cửa nạp hoa mới
            </Button>
          )}
          {current.availableActions.includes('open-for-check') && (
            <Button
              type="button"
              variant="outline"
              disabled={busy || !!visibleCode || issueReason.trim().length < 5}
              onClick={() => open.mutate('OPEN_FOR_CHECK')}
            >
              Mở cửa kiểm tra
            </Button>
          )}
          {slot.manualRetryEnabled && current.currentCmdId && (
            <Button
              type="button"
              variant="outline"
              disabled={busy || !!visibleCode || (current.retryAfterSeconds ?? 0) > 0}
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
      {current?.stage === 'Completed' && (
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setSavedSessionId(null);
            setIssued(undefined);
            onLoadFinished();
            queryClient.setQueryData(['slot-maintenance-active', kioskId, slot.id], null);
          }}
        >
          Đóng tiến độ
        </Button>
      )}
      {!hasStoredSession && canStart && (
        <div className="stock-maintenance-start">
          <label htmlFor={`maintenance-action-${slot.id}`}>Thao tác</label>
          <select
            id={`maintenance-action-${slot.id}`}
            value={action}
            onChange={(event) => setAction(event.target.value as MaintenanceAction)}
          >
            <option value="REMOVE">Thu hồi hoa</option>
            {canStock && <option value="REPLACE">Thay hoa</option>}
          </select>
          {action === 'REPLACE' && (
            <>
              <label htmlFor={`maintenance-product-${slot.id}`}>Mẫu hoa mới</label>
              <select
                id={`maintenance-product-${slot.id}`}
                value={productId}
                onChange={(event) => setProductId(event.target.value)}
              >
                <option value="">Chọn mẫu hoa</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
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
            disabled={
              busy ||
              !!visibleCode ||
              reason.trim().length < 5 ||
              (action === 'REPLACE' && !productId)
            }
            onClick={() => start.mutate()}
          >
            {start.isPending
              ? 'Đang lấy mã…'
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
      {(start.error || advance.error || open.error) && (
        <p role="alert" className="error">
          {start.error?.message || advance.error?.message || open.error?.message}
        </p>
      )}
    </section>
  );
}
