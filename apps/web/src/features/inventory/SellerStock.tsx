import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, Flower2, RefreshCw } from '@florabot/ui';
import type { components } from '../../../../../packages/contracts/src/generated/api';
import { queryClient, request, type Session } from '@/shared/lib/api';
import ReportFault from '../incidents/ReportFault';
import ReturnFlowers from '../orders/ReturnFlowers';
import RemoveSlotBouquet from './RemoveSlotBouquet';
import SlotMaintenance, { startMaintenance } from './SlotMaintenance';
import type { MaintenanceAccess } from './MaintenanceCode';
import AssignInventoryTask from './AssignInventoryTask';
import SellerRepairApprovals from './SellerRepairApprovals';
import { Modal } from '@/shared/components/Modal';
import './styles/seller-stock.css';
import { slotNeedsAttention, slotSaleState, slotWarning, type SellerSlot } from './slot-state';

// Never infer the selling zone from the slot code.
type Slot = SellerSlot;
type StockZone = 'WALK_IN' | 'PREORDER' | 'UNKNOWN';
type SlotFilter = 'ALL' | 'WALK_IN_EMPTY' | 'STOCKED' | 'PREORDER' | 'UNKNOWN' | 'ATTENTION';

const zoneLabels: Record<StockZone, string> = {
  WALK_IN: 'Walk-in',
  PREORDER: 'Pre-order',
  UNKNOWN: 'Chưa phân loại',
};

function slotZone(slot: Slot): StockZone {
  return slot.zone === 'WALK_IN' || slot.zone === 'PREORDER' ? slot.zone : 'UNKNOWN';
}

type Product = components['schemas']['ProductResponse'];
type SellerKiosk = components['schemas']['SellerKioskDto'];
type ProductPhotoPage = components['schemas']['ProductPhotoPage'];

function SlotStatus({ slot }: { slot: Slot }) {
  const state = slotSaleState(slot);
  const warning = slotWarning(slot);
  return (
    <span className="stock-slot-statuses">
      <span className="slot-status-pill" data-status={state.key}>
        {state.label}
      </span>
      {warning && warning !== state.label && (
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
}: {
  kioskId: string;
  totalSlots: number;
  currentWalkIn: number;
  currentPreorder: number;
}) {
  const [layoutOpen, setLayoutOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [walkIn, setWalkIn] = useState(String(currentWalkIn));
  const [preorder, setPreorder] = useState(String(currentPreorder));
  const [reason, setReason] = useState('');
  const [layoutNotice, setLayoutNotice] = useState('');
  const [layoutError, setLayoutError] = useState('');
  const [historyPage, setHistoryPage] = useState(1);

  const layoutRequests = useQuery({
    queryKey: ['kiosk-layout-requests', kioskId],
    queryFn: () => request<SlotLayoutRequestView[]>(`/me/kiosks/${kioskId}/layout-requests`),
    enabled: layoutOpen && !!kioskId,
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
      setLayoutNotice('Đã gửi yêu cầu đổi cơ cấu ô cho Quản lý vận hành xem xét.');
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
    (totalSlots === 0 || numWalk + numPre === totalSlots) &&
    reason.trim().length >= 5 &&
    reason.trim().length <= 500;

  return (
    <div
      className="stock-extra-panels"
      style={{ marginTop: '1rem', display: 'grid', gap: '0.75rem' }}
    >
      <details
        className="stock-toolbar-card"
        open={layoutOpen}
        onToggle={(e) => setLayoutOpen(e.currentTarget.open)}
      >
        <summary>
          <strong>Yêu cầu đổi cơ cấu ô (Walk-in / Pre-order)</strong> · Hiện tại: {currentWalkIn} ô
          Walk-in / {currentPreorder} ô Pre-order
        </summary>
        {layoutOpen && (
          <div style={{ marginTop: '0.75rem' }}>
            <p className="quiet">
              Tổng số ô phải giữ nguyên ({totalSlots} ô). Quản lý vận hành sẽ duyệt khi các ô cần
              đổi đang trống và không có đơn chờ nhận.
            </p>
            <form
              className="stock-fields"
              onSubmit={(e) => {
                e.preventDefault();
                if (layoutValid && !createLayoutRequest.isPending) {
                  createLayoutRequest.mutate();
                }
              }}
            >
              <div>
                <label htmlFor={`layout-walkin-${kioskId}`}>Số ô Walk-in mong muốn</label>
                <input
                  id={`layout-walkin-${kioskId}`}
                  type="number"
                  min={0}
                  max={totalSlots || 50}
                  step={1}
                  value={walkIn}
                  onChange={(e) => {
                    const nextWalk = e.target.value;
                    setWalkIn(nextWalk);
                    if (totalSlots > 0 && nextWalk !== '' && Number.isInteger(Number(nextWalk))) {
                      setPreorder(String(Math.max(0, totalSlots - Number(nextWalk))));
                    }
                  }}
                />
              </div>
              <div>
                <label htmlFor={`layout-preorder-${kioskId}`}>Số ô Pre-order mong muốn</label>
                <input
                  id={`layout-preorder-${kioskId}`}
                  type="number"
                  min={0}
                  max={totalSlots || 50}
                  step={1}
                  value={preorder}
                  onChange={(e) => setPreorder(e.target.value)}
                />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label htmlFor={`layout-reason-${kioskId}`}>Lý do thay đổi (5–500 ký tự)</label>
                <textarea
                  id={`layout-reason-${kioskId}`}
                  rows={2}
                  minLength={5}
                  maxLength={500}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Ví dụ: Tăng ô đặt trước dịp lễ 20/10…"
                />
              </div>
              <div className="stock-actions">
                <Button type="submit" disabled={!layoutValid || createLayoutRequest.isPending}>
                  {createLayoutRequest.isPending ? 'Đang gửi…' : 'Gửi yêu cầu đổi cơ cấu ô'}
                </Button>
              </div>
            </form>
            {(layoutError || layoutNotice) && (
              <p
                role={layoutError ? 'alert' : 'status'}
                className={layoutError ? 'error' : undefined}
              >
                {layoutError || layoutNotice}
              </p>
            )}
            {layoutRequests.isPending && <p role="status">Đang tải lịch sử yêu cầu…</p>}
            {layoutRequests.data && layoutRequests.data.length > 0 && (
              <ul className="admin-shop-list" style={{ marginTop: '0.75rem' }}>
                {layoutRequests.data.map((req) => (
                  <li key={req.id} className="shop-profile">
                    <p>
                      <strong>
                        {req.walkInSlots} ô Walk-in · {req.preorderSlots} ô Pre-order
                      </strong>{' '}
                      — {layoutStatusLabels[req.status] || req.status} (
                      {new Date(req.createdAt).toLocaleString('vi-VN')})
                    </p>
                    <p className="quiet">Lý do: {req.reason}</p>
                    {req.reviewNote && <p>Ghi chú duyệt: {req.reviewNote}</p>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </details>

      <details
        className="stock-toolbar-card"
        open={historyOpen}
        onToggle={(e) => setHistoryOpen(e.currentTarget.open)}
      >
        <summary>
          <strong>Lịch sử biến động hoa tại tủ</strong>
        </summary>
        {historyOpen && (
          <div style={{ marginTop: '0.75rem' }}>
            {history.isPending && <p role="status">Đang tải lịch sử biến động hoa…</p>}
            {history.isError && (
              <p role="alert" className="error">
                Chưa tải được lịch sử biến động hoa tại tủ.
              </p>
            )}
            {history.data && history.data.items.length === 0 && (
              <p className="quiet">Chưa có bản ghi biến động hoa tại kiosk này.</p>
            )}
            {history.data && history.data.items.length > 0 && (
              <>
                <ul className="admin-shop-list">
                  {history.data.items.map((entry) => (
                    <li key={entry.seq} className="shop-profile">
                      <p>
                        <strong>{entry.movementType}</strong>
                        {entry.slotCode ? ` · Ô ${entry.slotCode}` : ''}
                        {entry.orderCode ? ` · Đơn ${entry.orderCode}` : ''}
                      </p>
                      <p className="quiet">
                        Người thực hiện: {entry.actorName || 'Hệ thống'} ·{' '}
                        {new Date(entry.createdAt).toLocaleString('vi-VN')}
                      </p>
                    </li>
                  ))}
                </ul>
                <div className="stock-actions" style={{ marginTop: '0.5rem' }}>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={historyPage <= 1 || history.isFetching}
                    onClick={() => setHistoryPage((p) => p - 1)}
                  >
                    Trang trước
                  </Button>
                  <span>Trang {historyPage}</span>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!history.data.hasMore || history.isFetching}
                    onClick={() => setHistoryPage((p) => p + 1)}
                  >
                    Trang sau
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </details>
    </div>
  );
}

export default function SellerStock({ session }: { session: Session }) {
  const sellerId = session.sellerId;
  const [selectedKioskChoice, setSelectedKioskChoice] = useState('');
  const [slotFilter, setSlotFilter] = useState<SlotFilter>('ALL');
  const [message, setMessage] = useState('');
  const [stockReason, setStockReason] = useState('Nạp hoa bán trực tiếp');
  const [detailSlotId, setDetailSlotId] = useState<string | null>(null);
  const [loadAccess, setLoadAccess] = useState<{
    kioskId: string;
    slotId: string;
    access: MaintenanceAccess;
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
  });
  const selectedKioskId = kiosks.data?.some((kiosk) => kiosk.id === selectedKioskChoice)
    ? selectedKioskChoice
    : (kiosks.data?.[0]?.id ?? '');
  const slots = useQuery({
    queryKey: ['seller-kiosk-slots', sellerId, selectedKioskId],
    queryFn: () => request<Slot[]>(`/me/kiosks/${selectedKioskId}/slots`),
    enabled: !!sellerId && !!selectedKioskId,
  });
  const products = useQuery({
    queryKey: ['products', sellerId],
    queryFn: () => request<Product[]>('/me/products'),
    enabled: !!sellerId,
  });

  const stock = useMutation({
    mutationFn: async (values: z.infer<typeof schema>) => {
      if (Number(products.data?.find((item) => item.id === values.productId)?.quantity) === 0)
        throw new Error('Mẫu hoa đã hết tồn tại shop. Cập nhật tồn thực tế trước khi nạp.');
      const slot = slots.data?.find((item) => item.id === values.slotId);
      if (!slot) throw new Error('Ô không còn trong danh sách. Tải lại dữ liệu ô.');
      if (slot.sensorEnabled) {
        if (!slot.sensorReady)
          throw new Error('Ô chưa được admin xác minh đủ cảm biến cửa và hoa.');
        const access = await startMaintenance({
          kioskId: selectedKioskId,
          slot,
          action: 'LOAD',
          productId: values.productId,
          reason: stockReason,
        });
        return { kind: 'maintenance' as const, access };
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
        setLoadAccess({ kioskId: selectedKioskId, slotId: values.slotId, access: result.access });
        setMessage(
          `Đã cấp mã nạp hoa cho ô ${slot?.slotCode || ''}. Xem mã và tiến độ trong chi tiết ô.`,
        );
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

  const selectedKiosk = kiosks.data?.find((kiosk) => kiosk.id === selectedKioskId);
  const canStock = session.sellerStatus === 'ACTIVE';
  const allSlots = slots.data || [];
  const empty = allSlots.filter((slot) => slot.status === 'RENTED_EMPTY' && !slot.bouquetId);
  const walkInSlots = allSlots.filter((slot) => slotZone(slot) === 'WALK_IN');
  const matchingEmpty = empty.filter((slot) => slotZone(slot) === 'WALK_IN');
  const stockedSlots = allSlots.filter((slot) => !!slot.bouquetId);
  const preorderSlots = allSlots.filter((slot) => slotZone(slot) === 'PREORDER');
  const unclassifiedSlots = allSlots.filter((slot) => slotZone(slot) === 'UNKNOWN');
  const attentionSlots = allSlots.filter(slotNeedsAttention);

  const selectedSlot = matchingEmpty.find((slot) => slot.id === selectedSlotId);
  const detailSlot = allSlots.find((slot) => slot.id === detailSlotId);
  const available = products.data?.filter((product) => product.status === 'ACTIVE') || [];
  const selectedProduct = available.find((product) => product.id === selectedProductId);
  const slotsLoading = !!selectedKioskId && (slots.isPending || slots.isFetching);
  const slotSelectDisabled =
    !selectedKioskId || stock.isPending || slotsLoading || slots.isError || !matchingEmpty.length;
  const productSelectDisabled =
    !selectedSlot ||
    stock.isPending ||
    products.isPending ||
    products.isFetching ||
    products.isError ||
    !available.length;
  const blocked =
    !canStock ||
    !selectedKioskId ||
    stock.isPending ||
    slotsLoading ||
    products.isFetching ||
    slots.isError ||
    products.isError ||
    !matchingEmpty.length ||
    !available.length ||
    Number(selectedProduct?.quantity) === 0 ||
    (!!selectedSlot?.sensorEnabled && (!selectedSlot.sensorReady || stockReason.trim().length < 5));

  const filteredSlots = allSlots.filter((slot) => {
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
    <section className="seller-stock stock-page" aria-labelledby="stock-title">
      <h2 id="stock-title" className="sr-only">
        Quản lý hoa tại tủ
      </h2>
      {!canStock && (
        <p className="quiet stock-banner-notice stock-banner-warning">
          Shop cần có kỳ thuê đang hoạt động để nạp hoa. Bạn vẫn có thể xem các ô đang quản lý.
        </p>
      )}

      <SellerRepairApprovals key={sellerId} sellerId={sellerId} />
      <div className="stock-toolbar-card">
        <div className="stock-toolbar-top">
          <div className="stock-toolbar-title">
            <h3>Chọn tủ để quản lý hoa</h3>
            <p>Chọn kiosk để kiểm tra ô tủ và nạp hoa bán trực tiếp.</p>
          </div>
          <div className="stock-kiosk-controls">
            <div className="stock-kiosk-field">
              <label htmlFor="stock-kiosk">Kiosk của shop</label>
              <select
                id="stock-kiosk"
                value={selectedKioskId}
                disabled={kiosks.isPending || kiosks.isError || stock.isPending}
                onChange={(event) => {
                  setSelectedKioskChoice(event.target.value);
                  setSlotFilter('ALL');
                  setDetailSlotId(null);
                  form.reset({ slotId: '', productId: '' });
                  stock.reset();
                  setStockReason('Nạp hoa bán trực tiếp');
                  setMessage('');
                }}
              >
                <option value="">Chọn kiosk</option>
                {kiosks.data?.map((kiosk) => (
                  <option key={kiosk.id} value={kiosk.id}>
                    {kiosk.name} · {kiosk.code}
                  </option>
                ))}
              </select>
            </div>
            <div className="stock-actions">
              <Button
                type="button"
                variant="outline"
                disabled={
                  kiosks.isFetching || slots.isFetching || products.isFetching || stock.isPending
                }
                onClick={() => {
                  void kiosks.refetch();
                  void products.refetch();
                  if (selectedKioskId) void slots.refetch();
                  void queryClient.invalidateQueries({ queryKey: ['product-photos', sellerId] });
                }}
              >
                <RefreshCw
                  size={14}
                  aria-hidden="true"
                  className={
                    kiosks.isFetching || slots.isFetching || products.isFetching ? 'spin' : ''
                  }
                />
                Làm mới
              </Button>
            </div>
          </div>
        </div>

        {selectedKioskId && allSlots.length > 0 && (
          <div className="stock-tabs" role="group" aria-label="Bộ lọc nhanh danh sách ô">
            {(
              [
                { id: 'ALL', label: 'Tất cả ô', count: allSlots.length },
                { id: 'WALK_IN_EMPTY', label: 'Walk-in trống', count: matchingEmpty.length },
                { id: 'STOCKED', label: 'Đang có hoa', count: stockedSlots.length },
                { id: 'PREORDER', label: 'Ô đặt trước', count: preorderSlots.length },
                { id: 'UNKNOWN', label: 'Chưa phân loại', count: unclassifiedSlots.length },
                { id: 'ATTENTION', label: 'Cần xử lý', count: attentionSlots.length },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`stock-tab ${slotFilter === tab.id ? 'is-active' : ''}`}
                aria-pressed={slotFilter === tab.id}
                onClick={() => setSlotFilter(tab.id)}
              >
                <span>{tab.label}</span>
                <span className="stock-tab-count">{tab.count}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {(kiosks.isPending || products.isPending || slotsLoading) && (
        <p role="status">Đang tải kiosk, ô tủ và sản phẩm…</p>
      )}
      {(kiosks.isError || slots.isError || products.isError) && (
        <p role="alert" className="error">
          Chưa tải đủ dữ liệu quản lý kiosk. Chọn “Làm mới” để thử lại.
        </p>
      )}
      {!kiosks.isPending && !kiosks.isError && kiosks.data?.length === 0 && (
        <p className="stock-banner-notice">
          Shop chưa được phân bổ kiosk nào. Vui lòng liên hệ quản trị viên.
        </p>
      )}
      <p role="status" ref={notice} tabIndex={-1}>
        {message}
      </p>

      <nav className="stock-flow-links" aria-label="Các thao tác hoa tại tủ">
        {canStock && selectedKioskId && (
          <a href="#stock-fill" onClick={() => document.getElementById('stock-fill')?.focus()}>
            Nạp hoa bán tại tủ
          </a>
        )}
        <Link href="/seller/orders">Xử lý đơn đặt trước</Link>
        <Link href="/seller/products">Quản lý mẫu hoa</Link>
      </nav>
      <div className="stock-workbench">
        {canStock && selectedKioskId && (
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
                  { message: 'Ô không còn phù hợp. Chọn lại ô trống đúng hình thức bán.' },
                  { shouldFocus: true },
                );
                return;
              }
              stock.mutate(values);
            })}
          >
            <div className="stock-form-heading">
              <div>
                <h3>Nạp hoa vào tủ</h3>
                <p>
                  Chọn ô Walk-in trống và mẫu hoa. Ô có cảm biến sẽ mở cửa và xác nhận sau khi đặt
                  hoa thật.
                </p>
              </div>
              <span className="stock-form-badge">Walk-in</span>
            </div>
            {!slotsLoading && !slots.isError && !matchingEmpty.length && (
              <div className="stock-empty-notice" role="note">
                <strong>Không có ô Walk-in trống để nạp hoa</strong>
                <p>
                  {walkInSlots.length > 0
                    ? `${walkInSlots.length} ô đã chọn Walk-in, nhưng chưa ô nào trống để nạp bó mới.`
                    : 'Kiosk này chưa có ô nào được chọn làm Walk-in.'}
                </p>
                <p>
                  Loại ô được chốt theo hồ sơ thuê. Ô chưa phân loại không thể nạp hoa; liên hệ đội
                  vận hành để kiểm tra.
                </p>
              </div>
            )}
            {matchingEmpty.length > 0 && !slots.isError && (
              <>
                <div className="stock-fields">
                  <div>
                    <label htmlFor="stock-slot">1. Chọn ô Walk-in trống</label>
                    <select
                      id="stock-slot"
                      {...form.register('slotId')}
                      disabled={slotSelectDisabled}
                      aria-invalid={!!form.formState.errors.slotId}
                      aria-describedby="stock-slot-error"
                    >
                      <option value="">Chọn ô trống</option>
                      {matchingEmpty.map((slot) => (
                        <option key={slot.id} value={slot.id}>
                          Ô {slot.slotCode}
                        </option>
                      ))}
                    </select>
                    {form.formState.errors.slotId && (
                      <p className="error" id="stock-slot-error">
                        {form.formState.errors.slotId.message}
                      </p>
                    )}
                  </div>
                  <div>
                    <label htmlFor="stock-product">2. Chọn mẫu hoa</label>
                    <select
                      id="stock-product"
                      {...form.register('productId')}
                      disabled={productSelectDisabled}
                      aria-invalid={!!form.formState.errors.productId}
                      aria-describedby="stock-product-error stock-product-info"
                    >
                      <option value="">Chọn sản phẩm</option>
                      {available.map((product) => (
                        <option
                          key={product.id}
                          value={product.id}
                          disabled={Number(product.quantity) === 0}
                        >
                          {product.name}
                          {product.quantity == null ? '' : ` · Tồn shop: ${product.quantity} bó`}
                        </option>
                      ))}
                    </select>
                    {form.formState.errors.productId && (
                      <p className="error" id="stock-product-error">
                        {form.formState.errors.productId.message}
                      </p>
                    )}
                    <p className="quiet" id="stock-product-info">
                      {selectedProduct
                        ? `${selectedProduct.name} · ${money(selectedProduct.price)}${selectedProduct.shelfLifeHours ? ` · Hạn bán ${selectedProduct.shelfLifeHours} giờ từ lúc nạp` : ' · Hoa giả không áp dụng hạn tươi'}.`
                        : !selectedSlot
                          ? 'Chọn ô trống trước khi chọn mẫu hoa.'
                          : 'Chọn sản phẩm để xem giá và thông tin hạn bán.'}
                    </p>
                  </div>
                </div>
                {selectedProduct && Number(selectedProduct.quantity) === 0 && (
                  <p role="status" className="error">
                    Mẫu hoa đã hết tồn tại shop. Cập nhật tồn thực tế trong Mẫu hoa trước khi nạp.
                  </p>
                )}
                {selectedSlot && selectedProduct && (
                  <div
                    className="shop-profile stock-review-card"
                    role="note"
                    aria-label="Kiểm tra trước khi nạp hoa"
                  >
                    <div className="stock-review-head">
                      <strong>Kiểm tra trước khi nạp</strong>
                      <span className="slot-zone-label">{zoneLabels[slotZone(selectedSlot)]}</span>
                    </div>
                    <div className="stock-review-product">
                      <StockProductThumb sellerId={sellerId} productId={selectedProduct.id} />
                      <div className="stock-review-meta">
                        <p>
                          {selectedProduct.name} · {money(selectedProduct.price)}
                        </p>
                        <p>
                          {selectedKiosk?.name} · Ô {selectedSlot.slotCode}
                        </p>
                      </div>
                    </div>
                    <p className="quiet">
                      {slotZone(selectedSlot) === 'WALK_IN'
                        ? 'Bó này chỉ mua trực tiếp tại kiosk, không đặt hoặc thanh toán trên web.'
                        : slotZone(selectedSlot) === 'PREORDER'
                          ? 'Khách đặt và thanh toán trên web, rồi đến kiosk nhận bó hoa.'
                          : 'Chỉ ghi nhận nạp hoa; chưa xác nhận hình thức bán của ô này.'}
                    </p>
                  </div>
                )}
                {!products.isPending && !products.isError && !available.length && (
                  <p className="quiet">
                    Bật bán ít nhất một sản phẩm trong danh mục trước khi nạp hoa.
                  </p>
                )}
                {selectedSlot?.sensorEnabled && (
                  <div className="stock-maintenance-reason">
                    <label htmlFor="stock-maintenance-reason">Lý do nạp hoa</label>
                    <textarea
                      id="stock-maintenance-reason"
                      value={stockReason}
                      maxLength={500}
                      onChange={(event) => setStockReason(event.target.value)}
                    />
                    {!selectedSlot.sensorReady && (
                      <p role="note">Ô chưa được admin xác minh đủ cảm biến cửa và hoa.</p>
                    )}
                  </div>
                )}
                <div className="stock-actions">
                  <Button type="submit" disabled={blocked || !selectedSlot || !selectedProduct}>
                    {stock.isPending
                      ? 'Đang xử lý…'
                      : selectedSlot?.sensorEnabled
                        ? 'Lấy mã mở ô để nạp hoa'
                        : 'Nạp hoa vào ô'}
                  </Button>
                </div>
              </>
            )}
            <p className="stock-preorder-hint">
              Nạp hoa cho đơn đã thanh toán tại <Link href="/seller/orders">Đơn đặt trước</Link>,
              hoặc giao cho nhân viên tại <Link href="/seller/tasks">Giao việc nhân viên</Link>.
            </p>
            {stock.isError && (
              <div role="alert" className="error">
                <p>{stock.error.message}</p>
                <p>Làm mới kiosk để kiểm tra trạng thái ô trước khi thử lại.</p>
              </div>
            )}
          </form>
        )}

        {selectedKioskId && (
          <section className="stock-inventory" aria-labelledby="stock-slot-list">
            <div className="stock-inventory-heading">
              <div>
                <h3 id="stock-slot-list">Danh sách ô</h3>
                <p>{selectedKiosk?.name || 'Kiosk đã chọn'}</p>
              </div>
              {slots.data && (
                <span className="stock-inventory-count">
                  {filteredSlots.length}/{allSlots.length} ô
                </span>
              )}
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
                  <Button variant="outline" onClick={() => setSlotFilter('ALL')}>
                    Xem tất cả ô
                  </Button>
                </div>
              )}
            <ul className="admin-shop-list">
              {filteredSlots.map((slot) => {
                const zType = slotZone(slot);
                const zone = zoneLabels[zType];
                const slotProduct = slot.productId
                  ? products.data?.find((item) => item.id === slot.productId)
                  : undefined;
                const hasBouquet = !!slot.bouquetId || !!slot.productId;

                return (
                  <li key={slot.id}>
                    <button
                      type="button"
                      className="stock-slot-card"
                      onClick={() => setDetailSlotId(slot.id)}
                      aria-label={`Xem chi tiết ô ${slot.slotCode}`}
                    >
                      <div className="stock-slot-card-top">
                        <div className="stock-slot-card-id">
                          <strong>Ô {slot.slotCode}</strong>
                          <span className="quiet slot-zone-label">{zone}</span>
                        </div>
                        <SlotStatus slot={slot} />
                      </div>

                      <div className="stock-slot-card-body">
                        <StockProductThumb
                          sellerId={sellerId}
                          productId={slot.productId}
                          empty={!hasBouquet}
                        />
                        <div className="stock-slot-card-info">
                          <span className="stock-slot-product-name">
                            {hasBouquet
                              ? slotProduct?.name || 'Bó hoa đang trong tủ'
                              : zType === 'WALK_IN'
                                ? 'Ô trống sẵn sàng nạp hoa'
                                : zType === 'PREORDER'
                                  ? 'Ô dành cho đơn đặt trước'
                                  : 'Chưa phân loại · không thể nạp hoa'}
                          </span>
                          <span className="stock-slot-product-sub">
                            {hasBouquet
                              ? slot.priceSnapshot != null
                                ? `Giá niêm yết khi nạp: ${money(slot.priceSnapshot)}`
                                : 'Đã ghi nhận bó hoa trong ô'
                              : 'Nhấn để cấu hình hoặc kiểm tra ô'}
                          </span>
                        </div>
                      </div>

                      <div className="stock-slot-card-foot">
                        <span className="stock-slot-disclosure" aria-hidden="true">
                          Xem chi tiết →
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
            <Modal
              open={!!detailSlot}
              title={`Chi tiết ô ${detailSlot?.slotCode || ''}`}
              description={selectedKiosk?.name}
              onClose={closeSlotDetails}
              size="lg"
              className="stock-slot-modal"
            >
              {detailSlot && (
                <div className="stock-slot-modal-body" key={detailSlot.id}>
                  <div className="stock-slot-modal-status">
                    <SlotStatus slot={detailSlot} />
                    <span>{zoneLabels[slotZone(detailSlot)]}</span>
                  </div>
                  {(detailSlot.orderCode || detailSlot.orderId) && (
                    <p>
                      Đơn liên quan: <strong>{detailSlot.orderCode || detailSlot.orderId}</strong>
                    </p>
                  )}
                  {detailSlot.bouquetId && (
                    <div className="stock-slot-modal-bouquet">
                      <div className="stock-slot-modal-bouquet-head">
                        <StockProductThumb sellerId={sellerId} productId={detailSlot.productId} />
                        <strong>
                          {products.data?.find((product) => product.id === detailSlot.productId)
                            ?.name || 'Thông tin bó hoa trong ô'}
                        </strong>
                      </div>
                      <dl className="stock-slot-details">
                        <div>
                          <dt>Sản phẩm</dt>
                          <dd>
                            {products.data?.find((product) => product.id === detailSlot.productId)
                              ?.name || 'Chưa tải được tên sản phẩm'}
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
                  {canStock &&
                    detailSlot.zone === 'WALK_IN' &&
                    detailSlot.status === 'RENTED_EMPTY' &&
                    !detailSlot.bouquetId &&
                    !slotsLoading &&
                    !stock.isPending && (
                      <Button
                        disabled={
                          products.isPending ||
                          products.isFetching ||
                          products.isError ||
                          !available.length
                        }
                        onClick={() => {
                          form.setValue('slotId', detailSlot.id, { shouldValidate: true });
                          setDetailSlotId(null);
                          requestAnimationFrame(() => {
                            document
                              .getElementById('stock-fill')
                              ?.scrollIntoView({ block: 'center' });
                            form.setFocus('productId');
                          });
                        }}
                      >
                        Chọn ô này để nạp hoa
                      </Button>
                    )}

                  {detailSlot.sensorEnabled ? (
                    <SlotMaintenance
                      key={`${selectedKioskId}:${detailSlot.id}`}
                      sellerId={sellerId}
                      kioskId={selectedKioskId}
                      slot={detailSlot}
                      products={available}
                      canStock={canStock}
                      loadAccess={
                        loadAccess?.kioskId === selectedKioskId &&
                        loadAccess.slotId === detailSlot.id
                          ? loadAccess.access
                          : undefined
                      }
                      onLoadFinished={() => setLoadAccess(undefined)}
                    />
                  ) : (
                    <>
                      <RemoveSlotBouquet kioskId={selectedKioskId} slot={detailSlot} />
                      <ReturnFlowers slot={detailSlot} sellerId={sellerId} />
                    </>
                  )}
                  {canStock &&
                    detailSlot.sensorReady &&
                    slotZone(detailSlot) === 'WALK_IN' &&
                    ((!detailSlot.bouquetId && detailSlot.status === 'RENTED_EMPTY') ||
                      (detailSlot.bouquetId &&
                        ['STOCKED', 'PENDING_REMOVAL'].includes(detailSlot.status))) && (
                      <AssignInventoryTask
                        key={`${selectedKioskId}:${detailSlot.id}:${detailSlot.bouquetId}`}
                        sellerId={sellerId}
                        kioskId={selectedKioskId}
                        slot={detailSlot}
                        products={available.filter((product) => Number(product.quantity) !== 0)}
                      />
                    )}
                  <ReportFault slot={detailSlot} sellerId={sellerId} />
                </div>
              )}
            </Modal>
          </section>
        )}
      </div>
      {selectedKioskId && (
        <KioskLayoutAndHistoryPanels
          key={selectedKioskId}
          kioskId={selectedKioskId}
          totalSlots={allSlots.length}
          currentWalkIn={walkInSlots.length}
          currentPreorder={preorderSlots.length}
        />
      )}
    </section>
  );
}
