import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, CircleAlert, Flower2, Package, RefreshCw, Store } from '@florabot/ui';
import type { components } from '../../../../../packages/contracts/src/generated/api';
import { queryClient, request, type Session } from '@/shared/lib/api';
import ReportFault from '../incidents/ReportFault';
import ReturnFlowers from '../orders/ReturnFlowers';
import SlotZoneSelector from './SlotZoneSelector';
import RemoveSlotBouquet from './RemoveSlotBouquet';
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

export default function SellerStock({ session }: { session: Session }) {
  const sellerId = session.sellerId;
  const [selectedKioskChoice, setSelectedKioskChoice] = useState('');
  const [slotFilter, setSlotFilter] = useState<SlotFilter>('ALL');
  const [message, setMessage] = useState('');
  const [detailSlotId, setDetailSlotId] = useState<string | null>(null);
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
    mutationFn: (values: z.infer<typeof schema>) =>
      request('/me/flows/stock_bouquet', {
        productId: values.productId,
        slotId: values.slotId,
      } satisfies components['schemas']['StockBouquetRequest']),
    onSuccess: (_result, values) => {
      const slot = slots.data?.find((item) => item.id === values.slotId);
      const product = products.data?.find((item) => item.id === values.productId);
      setMessage(
        `Đã ghi nhận ${product?.name || 'bó hoa'} vào ô ${slot?.slotCode || ''} tại ${slot?.kioskName || 'kiosk đã chọn'}. ${zoneLabels[slot ? slotZone(slot) : 'UNKNOWN']}. Mã bó hoa được hệ thống tạo tự động.`,
      );
      form.reset({ slotId: '', productId: values.productId });
    },
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: ['seller-kiosk-slots', sellerId, selectedKioskId],
      }),
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
  const unclassifiedEmpty = empty.filter((slot) => slotZone(slot) === 'UNKNOWN');
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
    !available.length;

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
          Shop cần có gói đang hoạt động để nạp hoa. Bạn vẫn có thể xem các ô đang quản lý.
        </p>
      )}

      {selectedKioskId && allSlots.length > 0 && (
        <div
          className="stock-summary operations-metrics order-summary-strip"
          aria-label="Thống kê ô tủ"
        >
          <div className="operations-metric">
            <div className="stock-stat-top">
              <span>Tổng số ô quản lý</span>
              <div className="stock-stat-icon">
                <Store size={18} aria-hidden="true" />
              </div>
            </div>
            <strong>{allSlots.length}</strong>
            <small>{selectedKiosk?.name || 'Tại kiosk đang chọn'}</small>
          </div>
          <div className="operations-metric">
            <div className="stock-stat-top">
              <span>Ô có thể nạp hoa</span>
              <div className="stock-stat-icon stock-stat-icon--sky">
                <Package size={18} aria-hidden="true" />
              </div>
            </div>
            <strong>{matchingEmpty.length}</strong>
            <small>Bán trực tiếp · Walk-in</small>
          </div>
          <div className="operations-metric">
            <div className="stock-stat-top">
              <span>Ô đang có hoa</span>
              <div className="stock-stat-icon stock-stat-icon--green">
                <Flower2 size={18} aria-hidden="true" />
              </div>
            </div>
            <strong>{stockedSlots.length}</strong>
            <small>Ô có trạng thái đã nạp hoa</small>
          </div>
          <div className="operations-metric">
            <div className="stock-stat-top">
              <span>Cần theo dõi</span>
              <div className="stock-stat-icon stock-stat-icon--amber">
                <CircleAlert size={18} aria-hidden="true" />
              </div>
            </div>
            <strong>{attentionSlots.length}</strong>
            <small>Sự cố, đang khóa hoặc chờ xử lý</small>
          </div>
        </div>
      )}

      <div className="stock-toolbar-card">
        <div className="stock-toolbar-top">
          <div className="stock-toolbar-title">
            <h3>Kiosk đang quản lý</h3>
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

      <div className="stock-workbench">
        {canStock && selectedKioskId && (
          <form
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
                <span className="stock-eyebrow">BÁN TRỰC TIẾP</span>
                <h3>Nạp hoa vào tủ</h3>
                <p>Chọn ô Walk-in trống và mẫu hoa để ghi nhận một bó hoa.</p>
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
                {unclassifiedEmpty.length > 0 && (
                  <>
                    <p>
                      Trong {unclassifiedSlots.length} ô chưa phân loại, có{' '}
                      {unclassifiedEmpty.length} ô trống có thể chuyển sang Walk-in.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setDetailSlotId(unclassifiedEmpty[0].id)}
                    >
                      Phân loại ô {unclassifiedEmpty[0].slotCode}
                    </Button>
                  </>
                )}
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
                        <option key={product.id} value={product.id}>
                          {product.name}
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
                <div className="stock-actions">
                  <Button type="submit" disabled={blocked || !selectedSlot || !selectedProduct}>
                    {stock.isPending ? 'Đang ghi nhận…' : 'Nạp hoa vào ô'}
                  </Button>
                </div>
              </>
            )}
            <p className="stock-preorder-hint">
              Đơn đặt trước đã thanh toán được giao tại mục Đơn đặt trước hoặc công việc giao hoa
              của nhân viên.
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
                <span className="stock-eyebrow">QUẢN LÝ Ô TỦ</span>
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
                <p className="quiet">Không có ô tủ nào khớp với bộ lọc đang chọn.</p>
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
                                  : 'Chưa chọn hình thức bán'}
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
                  <SlotZoneSelector
                    kioskId={selectedKioskId}
                    slotId={detailSlot.id}
                    slotCode={detailSlot.slotCode}
                    zone={detailSlot.zone}
                    canEdit={
                      session.role === 'SELLER' &&
                      detailSlot.status === 'RENTED_EMPTY' &&
                      !detailSlot.bouquetId &&
                      !slotsLoading &&
                      !stock.isPending
                    }
                  />
                  <RemoveSlotBouquet kioskId={selectedKioskId} slot={detailSlot} />
                  <ReturnFlowers slot={detailSlot} sellerId={sellerId} />
                  <ReportFault slot={detailSlot} sellerId={sellerId} />
                </div>
              )}
            </Modal>
          </section>
        )}
      </div>
    </section>
  );
}
