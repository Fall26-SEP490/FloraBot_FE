import RefreshRegion from '@/shared/components/RefreshRegion';
import IconActionButton from '@/shared/components/IconActionButton';
import Link from 'next/link';

import { CustomSelect } from '@/shared/components/CustomSelect';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQueries, useQuery } from '@tanstack/react-query';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, Flower2 } from '@florabot/ui';
import type { components } from '../../../../../packages/contracts/src/generated/api';
import { queryClient, request, type Session } from '@/shared/lib/api';
import ReportFault from '../incidents/ReportFault';
import ReturnFlowers from '../orders/ReturnFlowers';
import RemoveSlotBouquet from './RemoveSlotBouquet';
import SlotMaintenance, {
  maintenancePath,
  startMaintenance,
  type MaintenanceSession,
} from './SlotMaintenance';
import AssignInventoryTask from './AssignInventoryTask';
import KioskPickerMap from '../kiosk-location/components/KioskPickerMap';
import { getKioskStatusLabel, isKioskActive } from '../kiosk-location/kiosk-location.utils';
import { stockKioskOptions, selectedStockKiosk } from './seller-stock-kiosks';
import { useStockKioskChoice } from './use-stock-kiosk-choice';
import { inventoryMovementLabel, inventoryActorLabel } from './seller-stock-history';
import { Modal } from '@/shared/components/Modal';
import './styles/seller-stock.css';
import {
  slotMaintenanceProgress,
  slotNeedsAttention,
  slotSaleState,
  slotWarning,
  type SellerSlot,
  type SlotMaintenanceProgress,
} from './slot-state';

// Never infer the selling zone from the slot code.
type Slot = SellerSlot;
type StockZone = 'WALK_IN' | 'PREORDER' | 'UNKNOWN';
type SlotFilter = 'ALL' | 'WALK_IN_EMPTY' | 'STOCKED' | 'PREORDER' | 'UNKNOWN' | 'ATTENTION';

const zoneLabels: Record<StockZone, string> = {
  WALK_IN: 'Tại chỗ',
  PREORDER: 'Đặt trước',
  UNKNOWN: 'Chưa phân loại',
};

function slotZone(slot: Slot): StockZone {
  return slot.zone === 'WALK_IN' || slot.zone === 'PREORDER' ? slot.zone : 'UNKNOWN';
}

type Product = components['schemas']['ProductResponse'];
type SellerKiosk = components['schemas']['SellerKioskDto'];
type ProductPhotoPage = components['schemas']['ProductPhotoPage'];

function SlotStatus({ slot, progress }: { slot: Slot; progress: SlotMaintenanceProgress | null }) {
  const state = slotSaleState(slot);
  const primary = state.key === 'LOCKED' && progress ? progress : state;
  const warning = progress ? null : slotWarning(slot);
  return (
    <span className="stock-slot-statuses">
      <span className="slot-status-pill" data-status={primary.key}>
        {primary.label}
      </span>
      {progress && progress !== primary && (
        <span className="slot-status-pill" data-status={progress.key}>
          {progress.label}
        </span>
      )}
      {warning && warning !== primary.label && (
        <span className="slot-status-pill" data-status={slot.status}>
          {warning}
        </span>
      )}
    </span>
  );
}

const guidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const schema = z.object({
  slotId: z.string().regex(guidPattern, 'Chọn ô trống để nạp hoa.'),
  productId: z.string().regex(guidPattern, 'Chọn sản phẩm đang bật bán.'),
});

const money = (value: number | string) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(value));

function StockProductThumb({
  sellerId,
  productId,
  empty = false,
}: {
  sellerId: string;
  productId?: string | null;
  empty?: boolean;
}) {
  const [brokenUrl, setBrokenUrl] = useState<string | null>(null);
  const photos = useQuery({
    queryKey: ['product-photos', sellerId, productId, 1],
    queryFn: () => request<ProductPhotoPage>(`/me/products/${productId}/photos?page=1`),
    enabled: !!sellerId && !!productId,
    staleTime: 60_000,
    retry: false,
  });

  const coverUrl = photos.data?.items?.[0]?.url;
  const showImage = !!coverUrl && brokenUrl !== coverUrl;

  return (
    <span
      className={`stock-product-thumb ${empty && !productId ? 'stock-product-thumb--empty' : ''}`}
      aria-hidden="true"
    >
      {showImage ? (
        <img src={coverUrl} alt="" loading="lazy" onError={() => setBrokenUrl(coverUrl)} />
      ) : (
        <Flower2 size={18} aria-hidden="true" />
      )}
    </span>
  );
}

interface SlotLayoutRequestView {
  id: string;
  kioskId: string;
  sellerId: string;
  walkInSlots: number;
  preorderSlots: number;
  reason: string;
  status: string;
  createdAt: string;
  reviewedAt: string | null;
  reviewNote: string | null;
}

interface SellerInventoryHistoryItem {
  seq: number;
  bouquetId: string | null;
  slotId: string | null;
  kioskId: string | null;
  slotCode: string | null;
  movementType: string;
  orderId: string | null;
  orderCode: string | null;
  performedBy: string | null;
  actorName: string | null;
  createdAt: string;
}

interface SellerInventoryHistoryPage {
  items: SellerInventoryHistoryItem[];
  page: number;
  hasMore: boolean;
}

const layoutStatusLabels: Record<string, string> = {
  PENDING: 'Chờ Quản lý vận hành duyệt',
  APPROVED: 'Đã áp dụng',
  REJECTED: 'Đã từ chối',
};

function KioskLayoutAndHistoryPanels({
  kioskId,
  totalSlots,
  currentWalkIn,
  currentPreorder,
  historyOpen,
}: {
  kioskId: string;
  totalSlots: number;
  currentWalkIn: number;
  currentPreorder: number;
  historyOpen: boolean;
}) {
  const [walkIn, setWalkIn] = useState(String(currentWalkIn));
  const [preorder, setPreorder] = useState(String(currentPreorder));
  const [reason, setReason] = useState('');
  const [layoutNotice, setLayoutNotice] = useState('');
  const [layoutError, setLayoutError] = useState('');
  const [historyPage, setHistoryPage] = useState(1);

  const layoutRequests = useQuery({
    queryKey: ['kiosk-layout-requests', kioskId],
    queryFn: () => request<SlotLayoutRequestView[]>(`/me/kiosks/${kioskId}/layout-requests`),
    enabled: !historyOpen && !!kioskId,
  });

  const createLayoutRequest = useMutation({
    mutationFn: () =>
      request<SlotLayoutRequestView>(
        `/me/kiosks/${kioskId}/layout-requests`,
        {
          walkInSlots: Number(walkIn),
          preorderSlots: Number(preorder),
          reason: reason.trim(),
        },
        true,
        'POST',
      ),
    onSuccess: async () => {
      setReason('');
      setLayoutError('');
      setLayoutNotice('Đã gửi yêu cầu.');
      await queryClient.invalidateQueries({ queryKey: ['kiosk-layout-requests', kioskId] });
    },
    onError: (err: unknown) => {
      setLayoutNotice('');
      setLayoutError(err instanceof Error ? err.message : 'Chưa gửi được yêu cầu đổi cơ cấu ô.');
    },
  });

  const history = useQuery({
    queryKey: ['seller-inventory-history', kioskId, historyPage],
    queryFn: () =>
      request<SellerInventoryHistoryPage>(
        `/me/inventory-history?kioskId=${encodeURIComponent(kioskId)}&page=${historyPage}`,
      ),
    enabled: historyOpen && !!kioskId,
  });

  const numWalk = Number(walkIn);
  const numPre = Number(preorder);
  const layoutValid =
    Number.isInteger(numWalk) &&
    Number.isInteger(numPre) &&
    numWalk >= 0 &&
    numPre >= 0 &&
    totalSlots > 0 &&
    numWalk + numPre === totalSlots &&
    (numWalk !== currentWalkIn || numPre !== currentPreorder) &&
    reason.trim().length >= 5 &&
    reason.trim().length <= 500;

  return (
    <div className="stock-extra-panels">
      <section className="stock-layout-inline" hidden={historyOpen} aria-label="Đổi ô tủ">
        <h2>Đổi ô tủ</h2>
        <p>Tổng {totalSlots} ô</p>
        <form
          className="stock-layout-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (layoutValid && !createLayoutRequest.isPending) createLayoutRequest.mutate();
          }}
        >
          <div className="stock-layout-columns">
            <div className="stock-layout-field">
              <label htmlFor={`layout-walkin-${kioskId}`}>Ô tại chỗ</label>
              <CustomSelect
                id={`layout-walkin-${kioskId}`}
                value={walkIn}
                disabled={createLayoutRequest.isPending || totalSlots === 0}
                options={Array.from({ length: totalSlots + 1 }, (_, count) => ({
                  value: String(count),
                  label: `${count} ô`,
                }))}
                onValueChange={(value) => {
                  setWalkIn(value);
                  setPreorder(String(totalSlots - Number(value)));
                  setLayoutNotice('');
                }}
              />
              <small>Hiện tại: {currentWalkIn} ô</small>
            </div>
            <div className="stock-layout-field">
              <label htmlFor={`layout-preorder-${kioskId}`}>Ô đặt trước</label>
              <CustomSelect
                id={`layout-preorder-${kioskId}`}
                value={preorder}
                disabled={createLayoutRequest.isPending || totalSlots === 0}
                options={Array.from({ length: totalSlots + 1 }, (_, count) => ({
                  value: String(count),
                  label: `${count} ô`,
                }))}
                onValueChange={(value) => {
                  setPreorder(value);
                  setWalkIn(String(totalSlots - Number(value)));
                  setLayoutNotice('');
                }}
              />
              <small>Hiện tại: {currentPreorder} ô</small>
            </div>
          </div>
          <p className="stock-layout-note">
            Tổng số ô không đổi. Các ô đổi loại cần trống và không có đơn chờ nhận; quản lý sẽ duyệt
            yêu cầu.
          </p>
          <div className="stock-layout-field">
            <div className="stock-layout-reason-label">
              <label htmlFor={`layout-reason-${kioskId}`}>Lý do</label>
              <small id={`layout-reason-help-${kioskId}`}>5–500 ký tự</small>
            </div>
            <textarea
              id={`layout-reason-${kioskId}`}
              rows={3}
              required
              minLength={5}
              maxLength={500}
              aria-describedby={`layout-reason-help-${kioskId}`}
              disabled={createLayoutRequest.isPending}
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
                setLayoutNotice('');
              }}
              placeholder="Nhập lý do đổi ô"
            />
          </div>
          {(layoutError || layoutNotice) && (
            <p
              role={layoutError ? 'alert' : 'status'}
              className={layoutError ? 'error' : 'stock-layout-notice'}
            >
              {layoutError || layoutNotice}
            </p>
          )}
          <div className="stock-layout-footer">
            <Button type="submit" disabled={!layoutValid || createLayoutRequest.isPending}>
              {createLayoutRequest.isPending ? 'Đang gửi…' : 'Gửi yêu cầu'}
            </Button>
          </div>
          {!!layoutRequests.data?.length && (
            <details className="stock-layout-past">
              <summary>Yêu cầu đã gửi ({layoutRequests.data.length})</summary>
              <ul>
                {layoutRequests.data.map((req) => (
                  <li key={req.id}>
                    <span>
                      {req.walkInSlots} tại chỗ / {req.preorderSlots} đặt trước
                    </span>
                    <span>{layoutStatusLabels[req.status] || req.status}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </form>
      </section>

      <section className="stock-history-panel" hidden={!historyOpen} aria-label="Lịch sử tồn kho">
        {historyOpen && (
          <div className="stock-history-content">
            {history.isPending && <p role="status">Đang tải lịch sử thay đổi…</p>}
            {history.isError && (
              <p role="alert" className="error">
                Chưa tải được lịch sử thay đổi tại tủ.{' '}
                <Button variant="outline" onClick={() => history.refetch()}>
                  Thử lại
                </Button>
              </p>
            )}
            {history.data && history.data.items.length === 0 && (
              <p className="quiet">
                {historyPage === 1
                  ? 'Chưa có bản ghi biến động hoa tại kiosk này.'
                  : 'Trang này không có dữ liệu.'}
              </p>
            )}
            {history.data && history.data.items.length > 0 && (
              <>
                <div className="stock-history-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Thời gian</th>
                        <th>Thay đổi</th>
                        <th>Ô</th>
                        <th>Đơn hàng</th>
                        <th>Người thực hiện</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.data.items.map((entry) => (
                        <tr key={entry.seq}>
                          <td>
                            {new Date(entry.createdAt).toLocaleString('vi-VN', {
                              timeZone: 'Asia/Ho_Chi_Minh',
                            })}
                          </td>
                          <td>{inventoryMovementLabel(entry.movementType)}</td>
                          <td>{entry.slotCode || '—'}</td>
                          <td>{entry.orderCode || '—'}</td>
                          <td>{inventoryActorLabel(entry.performedBy, entry.actorName)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            {history.data && (history.data.items.length > 0 || historyPage > 1) && (
              <nav className="stock-history-pagination" aria-label="Phân trang lịch sử tồn kho">
                <p role="status">
                  {history.data.items.length > 0
                    ? `Hiển thị ${(historyPage - 1) * 50 + 1}–${(historyPage - 1) * 50 + history.data.items.length}`
                    : 'Không có bản ghi trong trang này'}
                </p>
                <div className="stock-history-pages">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={historyPage <= 1 || history.isFetching}
                    onClick={() => setHistoryPage((p) => p - 1)}
                  >
                    Trước
                  </Button>
                  <span
                    className="stock-history-current"
                    aria-current="page"
                    aria-label={`Trang ${historyPage}`}
                  >
                    {historyPage}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!history.data.hasMore || history.isFetching}
                    onClick={() => setHistoryPage((p) => p + 1)}
                  >
                    Sau
                  </Button>
                </div>
              </nav>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

export default function SellerStock({ session }: { session: Session }) {
  const sellerId = session.sellerId;
  const [selectedKioskChoice, setSelectedKioskChoice] = useStockKioskChoice(session.id, sellerId);
  const [stockView, setStockView] = useState<'slots' | 'history'>('slots');
  const [slotFilter, setSlotFilter] = useState<SlotFilter>('ALL');
  const [slotSearch, setSlotSearch] = useState('');
  const [message, setMessage] = useState('');
  const [mapOpen, setMapOpen] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [stockReason, setStockReason] = useState('Nạp hoa bán trực tiếp');
  const [detailSlotId, setDetailSlotId] = useState<string | null>(null);
  const [assignmentBusy, setAssignmentBusy] = useState(false);
  const [operationChoice, setOperationChoice] = useState<{
    slotId: string;
    mode: 'SELF' | 'STAFF';
  } | null>(null);
  const [loadSession, setLoadSession] = useState<{
    kioskId: string;
    slotId: string;
    sessionId: string;
  }>();
  const closeSlotDetails = useCallback(() => setDetailSlotId(null), []);
  const notice = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (message) notice.current?.focus();
  }, [message]);
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    mode: 'onSubmit',
    reValidateMode: 'onChange',
    defaultValues: { slotId: '', productId: '' },
  });
  const selectedProductId = useWatch({ control: form.control, name: 'productId' });
  const selectedSlotId = useWatch({ control: form.control, name: 'slotId' });
  const kiosks = useQuery({
    queryKey: ['seller-kiosks', sellerId],
    queryFn: () => request<SellerKiosk[]>(`/sellers/${sellerId}/kiosks`),
    enabled: !!sellerId,
    refetchOnMount: 'always',
    refetchInterval: 30_000,
  });
  const availableKiosks = stockKioskOptions(kiosks.data ?? []);
  const selectedKiosk =
    selectedKioskChoice === null ||
    (!kiosks.isFetchedAfterMount &&
      selectedKioskChoice &&
      !availableKiosks.some((kiosk) => kiosk.id === selectedKioskChoice))
      ? undefined
      : selectedStockKiosk(availableKiosks, selectedKioskChoice);
  const selectedKioskId = selectedKiosk?.id ?? '';
  useEffect(() => {
    if (
      kiosks.isSuccess &&
      kiosks.isFetchedAfterMount &&
      !kiosks.isFetching &&
      selectedKioskId &&
      selectedKioskChoice !== selectedKioskId
    ) {
      setSelectedKioskChoice(selectedKioskId);
    }
  }, [
    kiosks.isSuccess,
    kiosks.isFetchedAfterMount,
    kiosks.isFetching,
    selectedKioskId,
    selectedKioskChoice,
    setSelectedKioskChoice,
  ]);
  const kioskOnline = !!selectedKiosk && isKioskActive(selectedKiosk.status);
  const slots = useQuery({
    queryKey: ['seller-kiosk-slots', sellerId, selectedKioskId],
    queryFn: () => request<Slot[]>(`/me/kiosks/${selectedKioskId}/slots`),
    enabled: !!sellerId && !!selectedKioskId,
    refetchOnMount: 'always',
    refetchInterval: (query) =>
      query.state.data?.some((slot) => slot.status === 'LOCKED' && slot.sensorEnabled)
        ? 4_000
        : 30_000,
  });
  const allSlots = slots.data || [];
  const legacySlots = allSlots.filter(
    (slot) =>
      slot.status === 'LOCKED' &&
      slot.sensorEnabled &&
      (slot.doorState === undefined || slot.maintenanceStage === undefined),
  );
  const legacySessions = useQueries({
    queries: legacySlots.map((slot) => ({
      queryKey: ['slot-maintenance-active', selectedKioskId, slot.id],
      queryFn: async () =>
        (await request<MaintenanceSession | undefined>(
          `${maintenancePath(selectedKioskId, slot.id)}/active`,
        )) ?? null,
      refetchInterval: 4_000,
    })),
  });
  const legacyProgress = new Map(
    legacySlots.map((slot, index) => [
      slot.id,
      legacySessions[index]?.isSuccess ? legacySessions[index].data : null,
    ]),
  );
  const products = useQuery({
    queryKey: ['products', sellerId],
    queryFn: () => request<Product[]>('/me/products'),
    enabled: !!sellerId,
    refetchOnMount: true,
  });

  const stock = useMutation({
    mutationFn: async (values: z.infer<typeof schema>) => {
      if (!kioskOnline) throw new Error('Chờ kiosk kết nối trước khi nạp hoa.');
      if (Number(products.data?.find((item) => item.id === values.productId)?.quantity) === 0)
        throw new Error('Mẫu hoa đã hết tồn tại shop. Cập nhật tồn thực tế trước khi nạp.');
      const slot = slots.data?.find((item) => item.id === values.slotId);
      if (!slot) throw new Error('Ô không còn trong danh sách. Tải lại dữ liệu ô.');
      if (slot.sensorEnabled) {
        if (!slot.sensorReady)
          throw new Error('Ô chưa được admin xác minh đủ cảm biến cửa và hoa.');
        const maintenance = await startMaintenance({
          kioskId: selectedKioskId,
          slot,
          action: 'LOAD',
          productId: values.productId,
          reason: stockReason,
        });
        return { kind: 'maintenance' as const, sessionId: maintenance.id };
      }
      await request('/me/flows/stock_bouquet', {
        productId: values.productId,
        slotId: values.slotId,
      } satisfies components['schemas']['StockBouquetRequest']);
      return { kind: 'legacy' as const };
    },
    onSuccess: (result, values) => {
      const slot = slots.data?.find((item) => item.id === values.slotId);
      const product = products.data?.find((item) => item.id === values.productId);
      if (result.kind === 'maintenance') {
        setLoadSession({
          kioskId: selectedKioskId,
          slotId: values.slotId,
          sessionId: result.sessionId,
        });
        setMessage(`Đã gửi yêu cầu mở ô ${slot?.slotCode || ''}. Xem tiến độ trong chi tiết ô.`);
        setDetailSlotId(values.slotId);
      } else {
        setMessage(
          `Đã ghi nhận ${product?.name || 'bó hoa'} vào ô ${slot?.slotCode || ''} tại ${slot?.kioskName || 'kiosk đã chọn'}. ${zoneLabels[slot ? slotZone(slot) : 'UNKNOWN']}. Mã bó hoa được hệ thống tạo tự động.`,
        );
      }
      form.reset({ slotId: '', productId: values.productId });
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['seller-kiosk-slots', sellerId, selectedKioskId],
        }),
        queryClient.invalidateQueries({ queryKey: ['products', sellerId] }),
      ]),
  });

  if (!sellerId) return null;

  const canStock = session.sellerStatus === 'ACTIVE';
  const empty = allSlots.filter((slot) => slot.status === 'RENTED_EMPTY' && !slot.bouquetId);
  const walkInSlots = allSlots.filter((slot) => slotZone(slot) === 'WALK_IN');
  const matchingEmpty = empty.filter((slot) => slotZone(slot) === 'WALK_IN');
  const preorderSlots = allSlots.filter((slot) => slotZone(slot) === 'PREORDER');

  const selectedSlot = matchingEmpty.find((slot) => slot.id === selectedSlotId);
  const detailSlot = allSlots.find((slot) => slot.id === detailSlotId);
  const operationMode = operationChoice?.slotId === detailSlotId ? operationChoice.mode : 'SELF';
  const canAssignInventory =
    !!detailSlot &&
    canStock &&
    detailSlot.sensorReady &&
    slotZone(detailSlot) === 'WALK_IN' &&
    ((!detailSlot.bouquetId && detailSlot.status === 'RENTED_EMPTY') ||
      (!!detailSlot.bouquetId && ['STOCKED', 'PENDING_REMOVAL'].includes(detailSlot.status)));
  const detailProgress = detailSlot
    ? slotMaintenanceProgress(detailSlot, legacyProgress.get(detailSlot.id))
    : null;
  const available =
    products.data?.filter(
      (product) => product.status === 'ACTIVE' && Number(product.quantity) !== 0,
    ) || [];
  const selectedProduct = available.find((product) => product.id === selectedProductId);
  const slotsLoading = !!selectedKioskId && slots.isPending;
  const productSelectDisabled =
    !selectedSlot ||
    stock.isPending ||
    products.isPending ||
    products.isFetching ||
    products.isError ||
    !available.length;
  const stockBlockReasons = [
    !canStock && 'Shop chưa có kỳ thuê đang hoạt động.',
    !selectedKioskId && 'Chọn kiosk để nạp hoa.',
    selectedKiosk &&
      !kioskOnline &&
      (selectedKiosk.status === 'OFFLINE'
        ? 'Kiosk đang ngoại tuyến. Chờ tủ kết nối lại để nạp hoa.'
        : `Kiosk đang ${getKioskStatusLabel(selectedKiosk.status).toLowerCase()}. Chưa thể nạp hoa.`),
    slotsLoading && 'Đang tải dữ liệu ô tủ…',
    slots.isError && 'Chưa tải được trạng thái ô. Hệ thống sẽ thử lại.',
    products.isError && 'Chưa tải được mẫu hoa. Hệ thống sẽ thử lại.',
    !products.isError && (products.isPending || products.isFetching) && 'Đang cập nhật mẫu hoa…',
    !slotsLoading &&
      !slots.isError &&
      !selectedSlot &&
      'Ô chưa phù hợp để nạp. Chọn ô trống tại chỗ.',
    products.isSuccess && !available.length && 'Chưa có mẫu hoa đang bán còn tồn tại shop.',
    available.length > 0 && !selectedProduct && 'Chọn mẫu hoa để tiếp tục.',
    selectedProduct && Number(selectedProduct.quantity) === 0 && 'Mẫu hoa đã hết tồn tại shop.',
    selectedSlot?.sensorEnabled &&
      !selectedSlot.sensorReady &&
      'Ô chưa được xác minh đủ cảm biến cửa và hoa. Liên hệ đội vận hành.',
    selectedSlot?.sensorEnabled &&
      stockReason.trim().length < 5 &&
      'Nhập lý do nạp hoa ít nhất 5 ký tự.',
  ].filter((reason): reason is string => typeof reason === 'string');
  const blocked = stock.isPending || stockBlockReasons.length > 0;

  const filteredSlots = allSlots.filter((slot) => {
    const productName = products.data?.find((product) => product.id === slot.productId)?.name || '';
    const text = `${slot.slotCode} ${productName} ${slot.orderCode || ''}`.toLocaleLowerCase('vi');
    if (!text.includes(slotSearch.trim().toLocaleLowerCase('vi'))) return false;
    if (slotFilter === 'WALK_IN_EMPTY') {
      return slot.status === 'RENTED_EMPTY' && !slot.bouquetId && slotZone(slot) === 'WALK_IN';
    }
    if (slotFilter === 'STOCKED') return !!slot.bouquetId;
    if (slotFilter === 'PREORDER') return slotZone(slot) === 'PREORDER';
    if (slotFilter === 'UNKNOWN') return slotZone(slot) === 'UNKNOWN';
    if (slotFilter === 'ATTENTION') return slotNeedsAttention(slot);
    return true;
  });

  return (
    <RefreshRegion>
      <section className="seller-stock stock-page" aria-labelledby="stock-title">
        <h2 id="stock-title" className="sr-only">
          Quản lý hoa tại tủ
        </h2>
        {!canStock && (
          <p className="quiet stock-banner-notice stock-banner-warning">
            Shop cần có kỳ thuê đang hoạt động để nạp hoa. Bạn vẫn có thể xem các ô đang quản lý.
          </p>
        )}

        <div className="stock-toolbar-card stock-kiosk-summary">
          <div className="stock-toolbar-top">
            <div className="stock-kiosk-controls">
              <div className="stock-kiosk-field">
                <label htmlFor="stock-kiosk">Kiosk của tôi</label>
                <CustomSelect
                  id="stock-kiosk"
                  value={selectedKioskId}
                  disabled={kiosks.isPending || kiosks.isError || stock.isPending}
                  onValueChange={(value) => {
                    setSelectedKioskChoice(value);
                    setStockView('slots');
                    setSlotFilter('ALL');
                    setSlotSearch('');
                    setDetailSlotId(null);
                    form.reset({ slotId: '', productId: '' });
                    stock.reset();
                    setStockReason('Nạp hoa bán trực tiếp');
                    setMessage('');
                  }}
                  options={
                    availableKiosks.length
                      ? availableKiosks.map((kiosk) => ({
                          value: kiosk.id,
                          label: `${kiosk.name} (${kiosk.code})`,
                        }))
                      : [{ value: '', label: 'Chọn kiosk' }]
                  }
                />
              </div>
            </div>
          </div>
          {selectedKiosk && (
            <div className="stock-location-card">
              <div>
                <div className="stock-location-heading">
                  <span>Vị trí</span>
                  <span className="stock-kiosk-status" data-connected={kioskOnline} role="status">
                    {kioskOnline
                      ? 'Trực tuyến'
                      : selectedKiosk.status === 'OFFLINE'
                        ? 'Ngoại tuyến'
                        : getKioskStatusLabel(selectedKiosk.status)}
                  </span>
                </div>
                <strong title={selectedKiosk.address || undefined}>
                  {selectedKiosk.address || 'Chưa cập nhật địa chỉ'}
                </strong>
              </div>
              <div className="stock-actions">
                <IconActionButton
                  action="reload"
                  label="Tải lại tủ và ô tủ"
                  disabled={kiosks.isFetching || slots.isFetching}
                  onClick={async () => {
                    await kiosks.refetch();
                    if (selectedKioskId) await slots.refetch();
                  }}
                />
                <IconActionButton
                  action="location"
                  label="Xem bản đồ và sửa vị trí"
                  className="stock-location-icon"
                  aria-label="Xem bản đồ và sửa vị trí"
                  title="Xem bản đồ và sửa vị trí"
                  onClick={() => setMapOpen(true)}
                />
              </div>
            </div>
          )}
        </div>
        <Modal open={mapOpen} title="Vị trí kiosk" onClose={() => setMapOpen(false)} size="lg">
          {mapOpen && selectedKiosk && (
            <>
              <p>{selectedKiosk.address || 'Chưa cập nhật địa chỉ'}</p>
              <p>{selectedKiosk.region || 'Chưa cập nhật khu vực'}</p>
              {selectedKiosk.latitude != null && selectedKiosk.longitude != null ? (
                <KioskPickerMap
                  latitude={Number(selectedKiosk.latitude)}
                  longitude={Number(selectedKiosk.longitude)}
                  interactive={false}
                />
              ) : (
                <p>Kiosk chưa có tọa độ bản đồ.</p>
              )}
              <Link className="button button-outline" href="/seller/kiosks">
                Sửa vị trí
              </Link>
            </>
          )}
        </Modal>
        {(kiosks.isPending || products.isPending || slotsLoading) && (
          <p role="status">Đang tải kiosk, ô tủ và sản phẩm…</p>
        )}
        {(kiosks.isError || slots.isError || products.isError) && (
          <p role="alert" className="error">
            Chưa tải đủ dữ liệu quản lý kiosk. Hệ thống sẽ tự thử lại.
          </p>
        )}
        {!kiosks.isPending && !kiosks.isError && kiosks.data?.length === 0 && (
          <p className="stock-banner-notice">
            Shop chưa được phân bổ kiosk nào. Vui lòng liên hệ quản trị viên.
          </p>
        )}
        {kiosks.isSuccess && !!kiosks.data?.length && availableKiosks.length === 0 && (
          <p className="stock-banner-notice" role="status">
            Các kiosk của shop hiện đã bị vô hiệu hóa.
          </p>
        )}
        <p role="status" ref={notice} tabIndex={-1}>
          {message}
        </p>

        {selectedKioskId && (
          <nav className="stock-view-tabs" aria-label="Nội dung quản lý tủ">
            <button
              type="button"
              aria-pressed={stockView === 'slots'}
              onClick={() => setStockView('slots')}
            >
              Ô tủ
            </button>
            <button
              type="button"
              aria-pressed={stockView === 'history'}
              onClick={() => {
                setDetailSlotId(null);
                setStockView('history');
              }}
            >
              Lịch sử
            </button>
          </nav>
        )}
        <div className="stock-main-layout">
          <div className="stock-workbench" hidden={stockView !== 'slots'}>
            {selectedKioskId && (
              <section className="stock-inventory" aria-labelledby="stock-slot-list">
                <h3 id="stock-slot-list" className="sr-only">
                  Ô tủ
                </h3>
                <div className="stock-table-filters">
                  <div>
                    <label htmlFor="stock-table-search">Tìm kiếm</label>
                    <input
                      id="stock-table-search"
                      type="search"
                      placeholder="Mã ô, tên hoa hoặc mã đơn"
                      value={slotSearch}
                      onChange={(event) => setSlotSearch(event.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor="stock-table-status">Trạng thái / loại ô</label>
                    <CustomSelect
                      id="stock-table-status"
                      value={slotFilter}
                      onValueChange={(value) => setSlotFilter(value as SlotFilter)}
                      options={[
                        { value: 'ALL', label: 'Tất cả ô' },
                        { value: 'WALK_IN_EMPTY', label: 'Ô trống tại chỗ' },
                        { value: 'STOCKED', label: 'Đang có hoa' },
                        { value: 'PREORDER', label: 'Ô đặt trước' },
                        { value: 'UNKNOWN', label: 'Chưa phân loại' },
                        { value: 'ATTENTION', label: 'Cần xử lý' },
                      ]}
                    />
                  </div>
                  <div className="stock-filter-actions">
                    {(slotSearch || slotFilter !== 'ALL') && (
                      <IconActionButton
                        action="clear"
                        label="Xóa bộ lọc ô tủ"
                        onClick={() => {
                          setSlotFilter('ALL');
                          setSlotSearch('');
                        }}
                      />
                    )}
                  </div>
                </div>
                {selectedKioskId && !slotsLoading && !slots.isError && allSlots.length === 0 && (
                  <p className="quiet">Kiosk chưa có ô nào để quản lý.</p>
                )}
                {selectedKioskId &&
                  !slotsLoading &&
                  allSlots.length > 0 &&
                  filteredSlots.length === 0 && (
                    <div className="stock-filter-empty" role="status">
                      <p>Không có ô tủ nào khớp với bộ lọc đang chọn.</p>
                    </div>
                  )}
                <div
                  className="stock-table-scroll"
                  role="region"
                  aria-label="Danh sách ô tủ"
                  hidden={filteredSlots.length === 0}
                >
                  <table className="stock-slots-table">
                    <thead>
                      <tr>
                        <th scope="col">Ô tủ</th>
                        <th scope="col">Loại ô</th>
                        <th scope="col">Mẫu hoa</th>
                        <th scope="col" className="stock-table-price">
                          Giá
                        </th>
                        <th scope="col">Trạng thái</th>
                        <th scope="col">
                          <span className="sr-only">Thao tác</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSlots.map((slot) => {
                        const product = products.data?.find((item) => item.id === slot.productId);
                        const progress = slotMaintenanceProgress(slot, legacyProgress.get(slot.id));
                        const openDetails = () => {
                          form.reset({ slotId: slot.id, productId: '' });
                          setProductSearch('');
                          stock.reset();
                          setDetailSlotId(slot.id);
                        };
                        return (
                          <tr key={slot.id} onClick={openDetails} data-status={slot.status}>
                            <th scope="row">
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openDetails();
                                }}
                                aria-label={`Xem chi tiết ô ${slot.slotCode}`}
                              >
                                {slot.slotCode}
                              </button>
                            </th>
                            <td>
                              <span className="stock-table-zone" data-zone={slotZone(slot)}>
                                {zoneLabels[slotZone(slot)]}
                              </span>
                            </td>
                            <td>
                              {slot.bouquetId || slot.productId ? (
                                product?.name || 'Bó hoa trong tủ'
                              ) : (
                                <span className="quiet">Ô trống</span>
                              )}
                            </td>
                            <td className="stock-table-price">
                              {slot.priceSnapshot == null ? '—' : money(slot.priceSnapshot)}
                            </td>
                            <td>
                              <SlotStatus slot={slot} progress={progress} />
                            </td>
                            <td className="stock-table-action">
                              <span aria-hidden="true">→</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <Modal
                  open={!!detailSlot}
                  title={`${detailSlot && detailSlot.status === 'RENTED_EMPTY' && slotZone(detailSlot) === 'WALK_IN' ? 'Nạp hoa vào ô' : 'Chi tiết ô'} ${detailSlot?.slotCode || ''}`}
                  description={selectedKiosk?.name}
                  onClose={closeSlotDetails}
                  closeDisabled={stock.isPending || assignmentBusy}
                  size="lg"
                  className="stock-slot-modal"
                >
                  {detailSlot && (
                    <div className="stock-slot-modal-body" key={detailSlot.id}>
                      <div className="stock-slot-modal-status">
                        <SlotStatus slot={detailSlot} progress={detailProgress} />
                        <span>{zoneLabels[slotZone(detailSlot)]}</span>
                      </div>
                      {(detailSlot.orderCode || detailSlot.orderId) && (
                        <p>
                          Đơn liên quan:{' '}
                          <strong>{detailSlot.orderCode || detailSlot.orderId}</strong>
                        </p>
                      )}
                      {detailSlot.bouquetId && (
                        <div className="stock-slot-modal-bouquet">
                          <div className="stock-slot-modal-bouquet-head">
                            <StockProductThumb
                              sellerId={sellerId}
                              productId={detailSlot.productId}
                            />
                            <strong>
                              {products.data?.find((product) => product.id === detailSlot.productId)
                                ?.name || 'Thông tin bó hoa trong ô'}
                            </strong>
                          </div>
                          <dl className="stock-slot-details">
                            <div>
                              <dt>Sản phẩm</dt>
                              <dd>
                                {products.data?.find(
                                  (product) => product.id === detailSlot.productId,
                                )?.name || 'Chưa tải được tên sản phẩm'}
                              </dd>
                            </div>
                            <div>
                              <dt>Mã bó hoa</dt>
                              <dd>{detailSlot.qrCode || 'Hệ thống chưa trả mã'}</dd>
                            </div>
                            <div>
                              <dt>Giá khi nạp</dt>
                              <dd>
                                {detailSlot.priceSnapshot == null
                                  ? 'Chưa có thông tin'
                                  : money(detailSlot.priceSnapshot)}
                              </dd>
                            </div>
                            <div>
                              <dt>Hạn bán</dt>
                              <dd>
                                {!detailSlot.sellableUntil ||
                                detailSlot.sellableUntil.startsWith('9999')
                                  ? 'Không áp dụng hạn tươi (Hoa giả)'
                                  : new Date(detailSlot.sellableUntil).toLocaleString('vi-VN', {
                                      timeZone: 'Asia/Ho_Chi_Minh',
                                    })}
                              </dd>
                            </div>
                          </dl>
                        </div>
                      )}
                      {canAssignInventory && (
                        <div
                          className="stock-operation-tabs"
                          role="tablist"
                          tabIndex={-1}
                          aria-label="Cách thực hiện"
                          onKeyDown={(event) => {
                            if (
                              !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key) ||
                              stock.isPending ||
                              assignmentBusy
                            )
                              return;
                            event.preventDefault();
                            const next =
                              event.key === 'Home'
                                ? 'SELF'
                                : event.key === 'End'
                                  ? 'STAFF'
                                  : operationMode === 'SELF'
                                    ? 'STAFF'
                                    : 'SELF';
                            setOperationChoice({ slotId: detailSlot.id, mode: next });
                            event.currentTarget
                              .querySelectorAll<HTMLButtonElement>('[role="tab"]')
                              [next === 'SELF' ? 0 : 1]?.focus();
                          }}
                        >
                          <button
                            type="button"
                            role="tab"
                            id="stock-self-tab"
                            tabIndex={operationMode === 'SELF' ? 0 : -1}
                            aria-selected={operationMode === 'SELF'}
                            aria-controls="stock-self-operation"
                            disabled={stock.isPending || assignmentBusy}
                            onClick={() =>
                              setOperationChoice({ slotId: detailSlot.id, mode: 'SELF' })
                            }
                          >
                            Tự thao tác tại tủ
                          </button>
                          <button
                            type="button"
                            role="tab"
                            id="stock-staff-tab"
                            tabIndex={operationMode === 'STAFF' ? 0 : -1}
                            aria-selected={operationMode === 'STAFF'}
                            aria-controls="stock-staff-operation"
                            disabled={stock.isPending || assignmentBusy}
                            onClick={() =>
                              setOperationChoice({ slotId: detailSlot.id, mode: 'STAFF' })
                            }
                          >
                            Giao nhân viên
                          </button>
                        </div>
                      )}
                      <div
                        id="stock-self-operation"
                        role={canAssignInventory ? 'tabpanel' : undefined}
                        aria-labelledby={canAssignInventory ? 'stock-self-tab' : undefined}
                        hidden={canAssignInventory && operationMode === 'STAFF'}
                      >
                        {canStock && selectedSlot && detailSlot?.id === selectedSlot.id && (
                          <form
                            id="stock-fill"
                            tabIndex={-1}
                            className="stock-form"
                            noValidate
                            onSubmit={form.handleSubmit((values) => {
                              const slot = slots.data?.find((item) => item.id === values.slotId);
                              if (
                                !slot ||
                                slot.kioskId !== selectedKioskId ||
                                slot.status !== 'RENTED_EMPTY' ||
                                !!slot.bouquetId ||
                                slot.zone !== 'WALK_IN'
                              ) {
                                form.setError(
                                  'slotId',
                                  {
                                    message:
                                      'Ô không còn phù hợp. Chọn lại ô trống đúng hình thức bán.',
                                  },
                                  { shouldFocus: true },
                                );
                                return;
                              }
                              stock.mutate(values);
                            })}
                          >
                            {!slotsLoading && !slots.isError && !matchingEmpty.length && (
                              <div className="stock-empty-notice" role="note">
                                <strong>Không có ô Walk-in trống để nạp hoa</strong>
                                <p>
                                  {walkInSlots.length > 0
                                    ? `${walkInSlots.length} ô đã chọn Walk-in, nhưng chưa ô nào trống để nạp bó mới.`
                                    : 'Kiosk này chưa có ô nào được chọn làm Walk-in.'}
                                </p>
                                <p>
                                  Loại ô được chốt theo hồ sơ thuê. Ô chưa phân loại không thể nạp
                                  hoa; liên hệ đội vận hành để kiểm tra.
                                </p>
                              </div>
                            )}
                            {matchingEmpty.length > 0 && !slots.isError && (
                              <>
                                <div className="stock-fields">
                                  <div>
                                    <input type="hidden" {...form.register('slotId')} />

                                    {form.formState.errors.slotId && (
                                      <p className="error" id="stock-slot-error">
                                        {form.formState.errors.slotId.message}
                                      </p>
                                    )}
                                  </div>
                                  <div>
                                    <label htmlFor="stock-product">Mẫu hoa</label>
                                    <input type="hidden" {...form.register('productId')} />
                                    {available.length > 8 && (
                                      <input
                                        id="stock-product-search"
                                        type="search"
                                        aria-label="Tìm mẫu hoa"
                                        placeholder="Tìm mẫu hoa"
                                        value={productSearch}
                                        disabled={stock.isPending}
                                        onChange={(event) => setProductSearch(event.target.value)}
                                      />
                                    )}
                                    <CustomSelect
                                      id="stock-product"
                                      value={selectedProductId || ''}
                                      disabled={productSelectDisabled}
                                      onValueChange={(value) =>
                                        form.setValue('productId', value, {
                                          shouldValidate: true,
                                          shouldDirty: true,
                                        })
                                      }
                                      options={[
                                        { value: '', label: 'Chọn mẫu hoa' },
                                        ...available
                                          .filter(
                                            (product) =>
                                              product.id === selectedProductId ||
                                              product.name
                                                .toLocaleLowerCase('vi')
                                                .includes(
                                                  productSearch.trim().toLocaleLowerCase('vi'),
                                                ),
                                          )
                                          .map((product) => ({
                                            value: product.id,
                                            label: `${product.name}${product.quantity == null ? '' : ` — Còn ${product.quantity} bó`}`,
                                            disabled: Number(product.quantity) === 0,
                                          })),
                                      ]}
                                    />
                                    {form.formState.errors.productId && (
                                      <p className="error" id="stock-product-error">
                                        {form.formState.errors.productId.message}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                {selectedProduct && Number(selectedProduct.quantity) === 0 && (
                                  <p role="status" className="error">
                                    Mẫu hoa đã hết tồn tại shop. Cập nhật tồn thực tế trong Mẫu hoa
                                    trước khi nạp.
                                  </p>
                                )}
                                {selectedSlot && selectedProduct && (
                                  <div className="stock-fill-preview">
                                    <StockProductThumb
                                      sellerId={sellerId}
                                      productId={selectedProduct.id}
                                    />
                                    <div>
                                      <strong>{money(selectedProduct.price)}</strong>
                                      <small>
                                        {selectedProduct.shelfLifeHours
                                          ? `Hạn bán ${selectedProduct.shelfLifeHours} giờ từ lúc nạp`
                                          : selectedProduct.name}
                                      </small>
                                    </div>
                                  </div>
                                )}{' '}
                                {!products.isPending && !products.isError && !available.length && (
                                  <p className="quiet">
                                    Bật bán ít nhất một sản phẩm trong danh mục trước khi nạp hoa.
                                  </p>
                                )}
                                {selectedSlot?.sensorEnabled && (
                                  <details className="stock-maintenance-reason">
                                    <summary>Ghi chú nạp hoa</summary>
                                    <label className="sr-only" htmlFor="stock-maintenance-reason">
                                      Lý do nạp hoa
                                    </label>
                                    <textarea
                                      id="stock-maintenance-reason"
                                      value={stockReason}
                                      maxLength={500}
                                      onChange={(event) => setStockReason(event.target.value)}
                                    />
                                    {!selectedSlot.sensorReady && (
                                      <p role="note">
                                        Ô chưa được admin xác minh đủ cảm biến cửa và hoa.
                                      </p>
                                    )}
                                  </details>
                                )}
                                <p className="stock-fill-note">
                                  Kiểm tra mẫu hoa và đứng cạnh tủ trước khi nạp.
                                </p>
                                {!stock.isPending && stockBlockReasons.length > 0 && (
                                  <div
                                    className="stock-fill-blockers"
                                    id="stock-fill-blockers"
                                    role="status"
                                  >
                                    {stockBlockReasons.map((reason) => (
                                      <p key={reason}>{reason}</p>
                                    ))}
                                  </div>
                                )}
                                <div className="stock-actions stock-fill-footer">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    disabled={stock.isPending}
                                    onClick={closeSlotDetails}
                                  >
                                    Hủy
                                  </Button>
                                  <Button
                                    type="submit"
                                    disabled={blocked || !selectedSlot || !selectedProduct}
                                    aria-describedby={
                                      !stock.isPending && stockBlockReasons.length
                                        ? 'stock-fill-blockers'
                                        : undefined
                                    }
                                  >
                                    {stock.isPending
                                      ? 'Đang xử lý…'
                                      : selectedSlot?.sensorEnabled
                                        ? 'Mở ô và nạp hoa'
                                        : 'Nạp hoa'}
                                  </Button>
                                </div>
                              </>
                            )}
                            {stock.isError && (
                              <div role="alert" className="error">
                                <p>{stock.error.message}</p>
                                <p>Kiểm tra trạng thái ô trước khi thử lại.</p>
                              </div>
                            )}
                          </form>
                        )}

                        {detailSlot.sensorEnabled ? (
                          <SlotMaintenance
                            key={`${selectedKioskId}:${detailSlot.id}`}
                            sellerId={sellerId}
                            kioskId={selectedKioskId}
                            slot={detailSlot}
                            products={available}
                            canStock={canStock}
                            loadSessionId={
                              loadSession?.kioskId === selectedKioskId &&
                              loadSession.slotId === detailSlot.id
                                ? loadSession.sessionId
                                : undefined
                            }
                            onLoadFinished={() => setLoadSession(undefined)}
                          />
                        ) : (
                          <>
                            <RemoveSlotBouquet kioskId={selectedKioskId} slot={detailSlot} />
                            <ReturnFlowers slot={detailSlot} sellerId={sellerId} />
                          </>
                        )}
                      </div>
                      {canAssignInventory && (
                        <div
                          id="stock-staff-operation"
                          role="tabpanel"
                          aria-labelledby="stock-staff-tab"
                          hidden={operationMode !== 'STAFF'}
                        >
                          <AssignInventoryTask
                            key={`${selectedKioskId}:${detailSlot.id}:${detailSlot.bouquetId}`}
                            sellerId={sellerId}
                            kioskId={selectedKioskId}
                            slot={detailSlot}
                            products={available.filter((product) => Number(product.quantity) !== 0)}
                            visible={operationMode === 'STAFF'}
                            onBusy={setAssignmentBusy}
                          />
                        </div>
                      )}
                      <details className="stock-slot-support" open={detailSlot.status === 'FAULT'}>
                        <summary>Báo sự cố</summary>
                        <ReportFault
                          slot={detailSlot}
                          sellerId={sellerId}
                          compact
                          onDone={closeSlotDetails}
                        />
                      </details>
                    </div>
                  )}
                </Modal>
              </section>
            )}
          </div>
          {selectedKioskId && slots.isSuccess && (
            <KioskLayoutAndHistoryPanels
              key={selectedKioskId}
              kioskId={selectedKioskId}
              totalSlots={allSlots.length}
              currentWalkIn={walkInSlots.length}
              currentPreorder={preorderSlots.length}
              historyOpen={stockView === 'history'}
            />
          )}
        </div>
      </section>
    </RefreshRegion>
  );
}
