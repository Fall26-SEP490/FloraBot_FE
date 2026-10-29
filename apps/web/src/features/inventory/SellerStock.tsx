import { useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, CircleAlert, Flower2, Package, RefreshCw, Store } from '@florabot/ui';
import type { components } from '../../../../../packages/contracts/src/generated/api';
import { queryClient, request, type Session } from '@/shared/lib/api';
import ReportFault from '../incidents/ReportFault';
import ReturnFlowers from '../orders/ReturnFlowers';

// The current seller slots response omits zone. Never infer it from slotCode.
type Slot = components['schemas']['SellerSlotResponse'] & { zone?: string | null };
type StockZone = 'WALK_IN' | 'PREORDER' | 'UNKNOWN';
const zoneLabels: Record<StockZone, string> = {
  WALK_IN: 'Bán trực tiếp tại kiosk (Walk-in)',
  PREORDER: 'Đặt và thanh toán trên web (Pre-order)',
  UNKNOWN: 'Chưa xác định hình thức bán',
};
function slotZone(slot: Slot): StockZone {
  return slot.zone === 'WALK_IN' || slot.zone === 'PREORDER' ? slot.zone : 'UNKNOWN';
}
type Product = components['schemas']['ProductResponse'];
type SellerKiosk = components['schemas']['SellerKioskDto'];

const statuses: Record<string, string> = {
  FREE: 'Chưa cho thuê',
  RENTED_EMPTY: 'Sẵn sàng nạp hoa',
  STOCKED: 'Đã nạp hoa',
  HELD: 'Khách đang thanh toán',
  PENDING_REMOVAL: 'Chờ lấy hoa hết hạn',
  PENDING_RELEASE: 'Chờ lấy hoa về để trả ô',
  FAULT: 'Có sự cố',
  LOCKED: 'Đang khóa',
};

const guidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const schema = z.object({
  zone: z.enum(['WALK_IN', 'PREORDER', 'UNKNOWN'], { message: 'Chọn hình thức bán của ô tủ.' }),
  slotId: z.string().regex(guidPattern, 'Chọn ô trống để nạp hoa.'),
  productId: z.string().regex(guidPattern, 'Chọn sản phẩm đang bật bán.'),
});

const money = (value: number | string) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(value));

export default function SellerStock({ session }: { session: Session }) {
  const sellerId = session.sellerId;
  const [selectedKioskChoice, setSelectedKioskChoice] = useState('');
  const [message, setMessage] = useState('');
  const notice = useRef<HTMLParagraphElement>(null);
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    mode: 'onBlur',
    reValidateMode: 'onChange',
    defaultValues: { slotId: '', productId: '' },
  });
  const selectedProductId = useWatch({ control: form.control, name: 'productId' });
  const selectedZone = useWatch({ control: form.control, name: 'zone' });
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
      form.reset({ slotId: '', productId: values.productId, zone: values.zone });
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
  const empty = slots.data?.filter((slot) => slot.status === 'RENTED_EMPTY') || [];
  const matchingEmpty = empty.filter((slot) => slotZone(slot) === selectedZone);
  const selectedSlot = matchingEmpty.find((slot) => slot.id === selectedSlotId);
  const hasUnknownZones = slots.data?.some((slot) => slotZone(slot) === 'UNKNOWN');
  const available = products.data?.filter((product) => product.status === 'ACTIVE') || [];
  const selectedProduct = available.find((product) => product.id === selectedProductId);
  const slotsLoading = !!selectedKioskId && (slots.isPending || slots.isFetching);
  const blocked =
    !canStock ||
    !selectedKioskId ||
    stock.isPending ||
    slotsLoading ||
    products.isFetching ||
    slots.isError ||
    products.isError ||
    !empty.length ||
    !available.length;

  return (
    <section className="seller-stock" aria-labelledby="stock-title">
      <h2 id="stock-title">Hoa tại kiosk</h2>
      <p>
        Chọn kiosk → hình thức bán của ô → ô trống → mẫu hoa cần nạp. Mỗi lần nạp tạo một bó hoa
        thực tế; tạo mẫu hoa trong danh mục chưa phải là nạp hoa vào tủ.
      </p>
      <p className="quiet">
        Ô Walk-in dành cho khách mua trực tiếp tại kiosk. Ô Pre-order dành cho đặt và thanh toán
        trên web, sau đó nhận hoa tại kiosk. Hình thức bán được quyết định bởi vùng ô đã cấu hình.
      </p>
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
              form.setValue('slotId', '');
              form.resetField('zone');
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
            Làm mới kiosk, ô và sản phẩm
          </Button>
        </div>
      </div>

      {(kiosks.isPending || products.isPending || slotsLoading) && (
        <p role="status">Đang tải kiosk, ô tủ và sản phẩm…</p>
      )}
      {(kiosks.isError || slots.isError || products.isError) && (
        <p role="alert" className="error">
          Chưa tải đủ dữ liệu quản lý kiosk. Chọn “Làm mới kiosk, ô và sản phẩm” để thử lại.
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
            <small>Tại {selectedKiosk?.name || 'kiosk đã chọn'}</small>
          </div>
          <div className="operations-metric">
            <Package aria-hidden="true" style={{ color: '#0369a1' }} />
            <span>Sẵn sàng nạp hoa</span>
            <strong style={{ color: '#0369a1' }}>{empty.length}</strong>
            <small>Ô còn trống</small>
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
              slotZone(slot) !== values.zone
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
          <div>
            <label htmlFor="stock-zone">Hình thức bán của ô tủ</label>
            <select
              id="stock-zone"
              {...form.register('zone', {
                onChange: () => {
                  form.setValue('slotId', '');
                  setMessage('');
                },
              })}
              disabled={blocked}
              aria-invalid={!!form.formState.errors.zone}
              aria-describedby="stock-zone-help stock-zone-error"
            >
              <option value="">Chọn hình thức bán</option>
              {(['WALK_IN', 'PREORDER', 'UNKNOWN'] as const).map((zone) => (
                <option
                  key={zone}
                  value={zone}
                  disabled={!empty.some((slot) => slotZone(slot) === zone)}
                >
                  {zoneLabels[zone]} ({empty.filter((slot) => slotZone(slot) === zone).length} ô
                  trống)
                </option>
              ))}
            </select>
            <p id="stock-zone-help" className="quiet">
              Chỉ lọc các ô đã có trong kiosk; lựa chọn này không thay đổi vùng ô hay kênh bán của
              bó hoa.
            </p>
            {form.formState.errors.zone && (
              <p className="error" id="stock-zone-error">
                {form.formState.errors.zone.message}
              </p>
            )}
          </div>
          {hasUnknownZones && (
            <p className="quiet" role="note">
              Một số ô chưa có thông tin vùng bán từ hệ thống. Không thể xác nhận bán tại kiosk hay
              trên web. Có thể chọn “Chưa xác định hình thức bán” để ghi nhận nạp vào các ô này; hãy
              xác nhận vùng ô với quản lý trước khi bán.
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
                disabled={blocked || !selectedZone}
                aria-invalid={!!form.formState.errors.slotId}
                aria-describedby="stock-slot-error"
              >
                <option value="">Chọn ô trống</option>
                {matchingEmpty.map((slot) => {
                  const zone = zoneLabels[slotZone(slot)];
                  return (
                    <option key={slot.id} value={slot.id}>
                      Ô {slot.slotCode}
                      {zone ? ` — ${zone}` : ''}
                    </option>
                  );
                })}
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
                disabled={blocked}
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
            <Button type="submit" disabled={blocked || (!!selectedZone && !matchingEmpty.length)}>
              {stock.isPending ? 'Đang ghi nhận…' : 'Nạp hoa vào ô'}
            </Button>
          </div>
          {stock.isError && (
            <div role="alert" className="error">
              <p>{stock.error.message}</p>
              <p>Làm mới kiosk để kiểm tra trạng thái ô trước khi thử lại.</p>
            </div>
          )}
        </form>
      )}

      {selectedKioskId && <h3>Các ô tại {selectedKiosk?.name || 'kiosk đã chọn'}</h3>}
      {selectedKioskId && !slotsLoading && slots.data?.length === 0 && (
        <p>Kiosk chưa có ô nào để quản lý.</p>
      )}
      <ul className="admin-shop-list">
        {slots.data?.map((slot) => {
          const zone = zoneLabels[slotZone(slot)];
          return (
            <li key={slot.id}>
              <details>
                <summary>
                  <strong>Ô {slot.slotCode}</strong>
                  <span className="quiet slot-zone-label">{zone}</span>
                  <span className="slot-status-pill" data-status={slot.status}>
                    {statuses[slot.status] || slot.status}
                  </span>
                </summary>
                <div className="shop-profile">
                  <p>
                    {slot.kioskName} · {slot.kioskCode} · {slot.kioskAddress}
                  </p>
                  {slot.bouquetId && (
                    <dl>
                      <div>
                        <dt>Sản phẩm</dt>
                        <dd>
                          {products.data?.find((product) => product.id === slot.productId)?.name ||
                            'Chưa tải được tên sản phẩm'}
                        </dd>
                      </div>
                      <div>
                        <dt>Mã bó hoa</dt>
                        <dd>{slot.qrCode || 'Hệ thống chưa trả mã'}</dd>
                      </div>
                      <div>
                        <dt>Giá khi nạp</dt>
                        <dd>
                          {slot.priceSnapshot == null
                            ? 'Chưa có thông tin'
                            : money(slot.priceSnapshot)}
                        </dd>
                      </div>
                      <div>
                        <dt>Hạn bán</dt>
                        <dd>
                          {!slot.sellableUntil || slot.sellableUntil.startsWith('9999')
                            ? 'Không áp dụng hạn tươi (Hoa giả)'
                            : new Date(slot.sellableUntil).toLocaleString('vi-VN', {
                                timeZone: 'Asia/Ho_Chi_Minh',
                              })}
                        </dd>
                      </div>
                    </dl>
                  )}
                  <ReturnFlowers slot={slot} sellerId={sellerId} />
                  <ReportFault slot={slot} sellerId={sellerId} />
                </div>
              </details>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
