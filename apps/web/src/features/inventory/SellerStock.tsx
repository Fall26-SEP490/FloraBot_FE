import { useCallback, useRef, useState } from 'react';
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
import { Modal } from '@/shared/components/Modal';

// Never infer the selling zone from the slot code.
type Slot = components['schemas']['SellerSlotResponse'] & { zone?: string | null };
type StockZone = 'WALK_IN' | 'PREORDER' | 'UNKNOWN';
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

const statuses: Record<string, string> = {
  FREE: 'Chưa cho thuê',
  RENTED_EMPTY: 'Ô trống',
  STOCKED: 'Đã nạp hoa',
  HELD: 'Khách đang thanh toán',
  PENDING_REMOVAL: 'Chờ lấy hoa hết hạn',
  PENDING_RELEASE: 'Chờ lấy hoa về để trả ô',
  FAULT: 'Có sự cố',
  LOCKED: 'Đang khóa',
};

const guidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const schema = z.object({
  slotId: z.string().regex(guidPattern, 'Chọn ô trống để nạp hoa.'),
  productId: z.string().regex(guidPattern, 'Chọn sản phẩm đang bật bán.'),
});

const money = (value: number | string) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(value));

export default function SellerStock({ session }: { session: Session }) {
  const sellerId = session.sellerId;
  const [selectedKioskChoice, setSelectedKioskChoice] = useState('');
  const [message, setMessage] = useState('');
  const [detailSlotId, setDetailSlotId] = useState<string | null>(null);
  const closeSlotDetails = useCallback(() => setDetailSlotId(null), []);
  const notice = useRef<HTMLParagraphElement>(null);
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    mode: 'onBlur',
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
      notice.current?.focus();
    },
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: ['seller-kiosk-slots', sellerId, selectedKioskId],
      }),
  });

  if (!sellerId) return null;

  const selectedKiosk = kiosks.data?.find((kiosk) => kiosk.id === selectedKioskId);
  const canStock = session.sellerStatus === 'ACTIVE';
  const empty =
    slots.data?.filter((slot) => slot.status === 'RENTED_EMPTY' && !slot.bouquetId) || [];
  const matchingEmpty = empty.filter((slot) => slotZone(slot) === 'WALK_IN');
  const selectedSlot = matchingEmpty.find((slot) => slot.id === selectedSlotId);
  const detailSlot = slots.data?.find((slot) => slot.id === detailSlotId);
  const unclassifiedEmpty = empty.filter((slot) => slotZone(slot) === 'UNKNOWN');
  const available = products.data?.filter((product) => product.status === 'ACTIVE') || [];
  const selectedProduct = available.find((product) => product.id === selectedProductId);
  const slotsLoading = !!selectedKioskId && (slots.isPending || slots.isFetching);
  const slotSelectDisabled =
    !selectedKioskId || stock.isPending || slotsLoading || slots.isError || !matchingEmpty.length;
  const productSelectDisabled =
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

  return (
    <section className="seller-stock" aria-labelledby="stock-title">
      <h2 id="stock-title" className="sr-only">
        Quản lý hoa tại tủ
      </h2>
      {!canStock && (
        <p className="quiet">
          Shop cần có gói đang hoạt động để nạp hoa. Bạn vẫn có thể xem các ô đang quản lý.
        </p>
      )}

      <div className="product-filters">
        <div>
          <label htmlFor="stock-kiosk">Kiosk của shop</label>
          <select
            id="stock-kiosk"
            value={selectedKioskId}
            disabled={kiosks.isPending || kiosks.isError || stock.isPending}
            onChange={(event) => {
              setSelectedKioskChoice(event.target.value);
              setDetailSlotId(null);
              form.setValue('slotId', '');
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
            }}
          >
            <RefreshCw
              size={15}
              aria-hidden="true"
              className={kiosks.isFetching || slots.isFetching || products.isFetching ? 'spin' : ''}
            />
            Làm mới
          </Button>
        </div>
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
        <p>Shop chưa được phân bổ kiosk nào. Vui lòng liên hệ quản trị viên.</p>
      )}
      <p role="status" ref={notice} tabIndex={-1}>
        {message}
      </p>

      {selectedKioskId && slots.data && slots.data.length > 0 && (
        <div className="operations-metrics order-summary-strip" aria-label="Thống kê ô tủ">
          <div className="operations-metric">
            <Store aria-hidden="true" />
            <span>Tổng số ô quản lý</span>
            <strong>{slots.data.length}</strong>
          </div>
          <div className="operations-metric">
            <Package aria-hidden="true" style={{ color: '#0369a1' }} />
            <span>Ô Walk-in sẵn sàng</span>
            <strong style={{ color: '#0369a1' }}>{matchingEmpty.length}</strong>
            <small>
              {empty.length} ô trống · {unclassifiedEmpty.length} ô chưa phân loại
            </small>
          </div>
          <div className="operations-metric">
            <Flower2 aria-hidden="true" style={{ color: '#16a34a' }} />
            <span>Đã nạp hoa</span>
            <strong style={{ color: 'var(--color-status-success-ink)' }}>
              {slots.data.filter((s) => s.status === 'STOCKED').length}
            </strong>
            <small>Bó thực tế trong các ô tủ</small>
          </div>
          <div className="operations-metric">
            <CircleAlert aria-hidden="true" style={{ color: '#b45309' }} />
            <span>Cần theo dõi</span>
            <strong style={{ color: '#b45309' }}>
              {
                slots.data.filter((s) =>
                  ['FAULT', 'PENDING_REMOVAL', 'PENDING_RELEASE', 'LOCKED', 'HELD'].includes(
                    s.status,
                  ),
                ).length
              }
            </strong>
            <small>Sự cố / lấy hoa</small>
          </div>
        </div>
      )}

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
              <p className="stock-empty-notice" role="note">
                Chưa có ô Walk-in trống để nạp hoa bán sẵn.
                {unclassifiedEmpty.length > 0 && (
                  <>
                    {' '}
                    Có {unclassifiedEmpty.length} ô trống chưa phân loại.{' '}
                    <a href="#stock-slot-list">Chọn hình thức bán cho ô bên dưới</a> trước khi nạp.
                  </>
                )}
              </p>
            )}
            <div className="stock-fields">
              <div>
                <label htmlFor="stock-slot">
                  Ô trống tại {selectedKiosk?.name || 'kiosk đã chọn'}
                </label>
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
                <label htmlFor="stock-product">Sản phẩm nạp vào ô</label>
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
                    : 'Chọn sản phẩm để xem giá và thông tin hạn bán.'}
                </p>
              </div>
            </div>
            {selectedSlot && selectedProduct && (
              <div className="shop-profile" role="note" aria-label="Kiểm tra trước khi nạp hoa">
                <strong>Kiểm tra trước khi nạp</strong>
                <p>
                  {selectedProduct.name} · {money(selectedProduct.price)}
                </p>
                <p>
                  {selectedKiosk?.name} · Ô {selectedSlot.slotCode}
                </p>
                <p>{zoneLabels[slotZone(selectedSlot)]}</p>
                <p className="quiet">
                  {slotZone(selectedSlot) === 'WALK_IN'
                    ? 'Bó này chỉ mua trực tiếp tại kiosk, không đặt hoặc thanh toán trên web.'
                    : slotZone(selectedSlot) === 'PREORDER'
                      ? 'Khách đặt và thanh toán trên web, rồi đến kiosk nhận bó hoa.'
                      : 'Chỉ ghi nhận nạp hoa; chưa xác nhận hình thức bán của ô này.'}
                </p>
              </div>
            )}
            {!slotsLoading && !slots.isError && !empty.length && (
              <p>Kiosk này chưa có ô trống để nạp hoa.</p>
            )}
            {!products.isPending && !products.isError && !available.length && (
              <p>Bật bán ít nhất một sản phẩm trong danh mục trước khi nạp hoa.</p>
            )}
            <div className="stock-actions">
              <Button type="submit" disabled={blocked || !selectedSlot || !selectedProduct}>
                {stock.isPending ? 'Đang ghi nhận…' : 'Nạp hoa vào ô'}
              </Button>
            </div>
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
              {slots.data && <span className="stock-inventory-count">{slots.data.length} ô</span>}
            </div>
            {selectedKioskId && !slotsLoading && slots.data?.length === 0 && (
              <p>Kiosk chưa có ô nào để quản lý.</p>
            )}
            <ul className="admin-shop-list">
              {slots.data?.map((slot) => {
                const zone = zoneLabels[slotZone(slot)];
                return (
                  <li key={slot.id}>
                    <button
                      type="button"
                      className="stock-slot-card"
                      onClick={() => setDetailSlotId(slot.id)}
                      aria-label={`Xem chi tiết ô ${slot.slotCode}`}
                    >
                      <strong>Ô {slot.slotCode}</strong>
                      <span className="quiet slot-zone-label">{zone}</span>
                      <span className="slot-status-pill" data-status={slot.status}>
                        {statuses[slot.status] || slot.status}
                      </span>
                      <span className="stock-slot-disclosure" aria-hidden="true">
                        Xem chi tiết →
                      </span>
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
                    <span className="slot-status-pill" data-status={detailSlot.status}>
                      {statuses[detailSlot.status] || detailSlot.status}
                    </span>
                    <span>{zoneLabels[slotZone(detailSlot)]}</span>
                  </div>
                  {detailSlot.bouquetId && (
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
                          {!detailSlot.sellableUntil || detailSlot.sellableUntil.startsWith('9999')
                            ? 'Không áp dụng hạn tươi (Hoa giả)'
                            : new Date(detailSlot.sellableUntil).toLocaleString('vi-VN', {
                                timeZone: 'Asia/Ho_Chi_Minh',
                              })}
                        </dd>
                      </div>
                    </dl>
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
