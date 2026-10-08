import { useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@florabot/ui';
import type { components } from '../../../packages/contracts/src/generated/api';
import { queryClient, request, type Session } from './api';
import ReportFault from './ReportFault';
import ReturnFlowers from './ReturnFlowers';

type Slot = components['schemas']['SellerSlotResponse'];
type Product = components['schemas']['ProductResponse'];
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
const schema = z.object({
  slotId: z.string().min(1, 'Chọn ô trống để nạp hoa.'),
  productId: z.string().min(1, 'Chọn sản phẩm đang bật bán.'),
  qr: z
    .string()
    .trim()
    .min(1, 'Nhập mã trên tem của bó hoa.')
    .max(200, 'Mã bó hoa không quá 200 ký tự.'),
});
const money = (value: number | string) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(value));

export default function SellerStock({ session }: { session: Session }) {
  const sellerId = session.sellerId;
  const [batch, setBatch] = useState(() => crypto.randomUUID());
  const [stocked, setStocked] = useState(0);
  const [message, setMessage] = useState('');
  const notice = useRef<HTMLParagraphElement>(null);
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { slotId: '', productId: '', qr: '' },
  });
  const selectedProductId = useWatch({ control: form.control, name: 'productId' });
  const slots = useQuery({
    queryKey: ['seller-slots', sellerId],
    queryFn: () => request<Slot[]>(`/sellers/${sellerId}/slots`),
    enabled: !!sellerId,
  });
  const products = useQuery({
    queryKey: ['products', sellerId],
    queryFn: () => request<Product[]>(`/sellers/${sellerId}/products`),
    enabled: !!sellerId,
  });
  const stock = useMutation({
    mutationFn: (values: z.infer<typeof schema>) =>
      request(`/sellers/${sellerId}/flows/stock_bouquet`, {
        p_batch: batch,
        p_slot: values.slotId,
        p_product: values.productId,
        p_qr: values.qr,
      } satisfies components['schemas']['StockBouquetRequest']),
    onSuccess: (_result, values) => {
      const slot = slots.data?.find((item) => item.id === values.slotId);
      setMessage(
        `Đã ghi nhận bó ${values.qr} vào ô ${slot?.slotCode || ''} tại ${slot?.kioskName || 'kiosk đã chọn'}.`,
      );
      setStocked((count) => count + 1);
      form.reset({ slotId: '', productId: values.productId, qr: '' });
      notice.current?.focus();
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['seller-slots', sellerId] }),
  });
  if (!sellerId) return null;
  const canStock = session.sellerStatus === 'ACTIVE';
  const empty = slots.data?.filter((slot) => slot.status === 'RENTED_EMPTY') || [];
  const available = products.data?.filter((product) => product.status === 'ACTIVE') || [];
  const selectedProduct = available.find((product) => product.id === selectedProductId);
  const blocked =
    !canStock ||
    stock.isPending ||
    slots.isFetching ||
    products.isFetching ||
    slots.isError ||
    products.isError ||
    !empty.length ||
    !available.length;
  return (
    <section className="seller-stock" aria-labelledby="stock-title">
      <h2 id="stock-title">Mang hoa mới đến tủ</h2>
      <p>
        Đặt bó hoa vào đúng ô đã thuê, kiểm tra tem rồi ghi nhận tại đây. Những bó nạp trong cùng
        lần đến tủ được gom thành một lô.
      </p>
      {!canStock && (
        <p className="quiet">
          Shop cần có gói đang hoạt động để nạp hoa. Bạn vẫn có thể xem các ô đang thuê.
        </p>
      )}
      <Button
        variant="outline"
        disabled={slots.isFetching || products.isFetching || stock.isPending}
        onClick={() => {
          void slots.refetch();
          void products.refetch();
        }}
      >
        Làm mới ô và sản phẩm
      </Button>
      {(slots.isPending || products.isPending) && <p role="status">Đang tải ô tủ và sản phẩm…</p>}
      {(slots.isError || products.isError) && (
        <p role="alert" className="error">
          Chưa tải đủ ô tủ và sản phẩm. Chọn “Làm mới ô và sản phẩm” để thử lại.
        </p>
      )}
      <p role="status" ref={notice} tabIndex={-1}>
        {message}
      </p>
      {canStock && (
        <form
          className="stock-form"
          noValidate
          onSubmit={form.handleSubmit((values) => stock.mutate(values))}
        >
          <div className="stock-fields">
            <div>
              <label htmlFor="stock-slot">Ô trống của shop</label>
              <select
                id="stock-slot"
                {...form.register('slotId')}
                disabled={blocked}
                aria-invalid={!!form.formState.errors.slotId}
                aria-describedby="stock-slot-error"
              >
                <option value="">Chọn kiosk và ô</option>
                {empty.map((slot) => (
                  <option key={slot.id} value={slot.id}>
                    {slot.kioskName} · {slot.kioskCode} · Ô {slot.slotCode}
                  </option>
                ))}
              </select>
              <p className="error" id="stock-slot-error">
                {form.formState.errors.slotId?.message}
              </p>
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
              <p className="error" id="stock-product-error">
                {form.formState.errors.productId?.message}
              </p>
              <p className="quiet" id="stock-product-info">
                {selectedProduct
                  ? `${selectedProduct.name} · ${money(selectedProduct.price)} · Hạn bán ${selectedProduct.shelfLifeHours} giờ từ lúc nạp.`
                  : 'Chọn sản phẩm để xem giá và hạn bán.'}
              </p>
            </div>
          </div>
          <label htmlFor="stock-qr">Mã trên tem bó hoa</label>
          <input
            id="stock-qr"
            {...form.register('qr')}
            maxLength={200}
            autoComplete="off"
            disabled={blocked}
            aria-invalid={!!form.formState.errors.qr}
            aria-describedby="stock-qr-error stock-qr-help"
          />
          <p className="error" id="stock-qr-error">
            {form.formState.errors.qr?.message}
          </p>
          <p className="quiet" id="stock-qr-help">
            Mỗi bó có một mã riêng. Giá và hạn bán được ghi nhận từ sản phẩm tại thời điểm nạp.
          </p>
          {!slots.isPending && !slots.isError && !empty.length && (
            <p>Chưa có ô trống để nạp. Liên hệ đội ngũ vận hành nếu shop cần thêm ô.</p>
          )}
          {!products.isPending && !products.isError && !available.length && (
            <p>Bật bán ít nhất một sản phẩm trong danh mục trước khi nạp hoa.</p>
          )}
          <div className="stock-actions">
            <Button type="submit" disabled={blocked}>
              {stock.isPending ? 'Đang ghi nhận…' : 'Ghi nhận bó hoa vào ô'}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={stock.isPending}
              onClick={() => {
                setBatch(crypto.randomUUID());
                setStocked(0);
                setMessage('Đã bắt đầu lô nạp mới.');
                stock.reset();
              }}
            >
              Bắt đầu lô mới
            </Button>
          </div>
          <p className="quiet">Lô hiện tại: đã nhận phản hồi thành công cho {stocked} bó.</p>
          {stock.isError && (
            <div role="alert" className="error">
              <p>{stock.error.message}</p>
              <p>
                Kiểm tra danh sách ô đã cập nhật trước khi gửi lại. Nếu mất kết nối, hãy làm mới và
                đối chiếu mã bó để biết lần gửi trước đã được ghi nhận chưa.
              </p>
            </div>
          )}
        </form>
      )}
      <h3>Các ô shop đang thuê</h3>
      {slots.data?.length === 0 && (
        <p>Shop chưa có ô tủ. Sau khi thanh toán gói, đội ngũ sẽ gán ô đã thống nhất.</p>
      )}
      <ul className="admin-shop-list">
        {slots.data?.map((slot) => (
          <li key={slot.id}>
            <details>
              <summary>
                <strong>
                  {slot.kioskName} · Ô {slot.slotCode}
                </strong>
                <span>{statuses[slot.status] || slot.status}</span>
              </summary>
              <div className="shop-profile">
                <p>
                  {slot.kioskCode} · {slot.kioskAddress}
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
                      <dd>{slot.qrCode}</dd>
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
                        {slot.sellableUntil
                          ? new Date(slot.sellableUntil).toLocaleString('vi-VN', {
                              timeZone: 'Asia/Ho_Chi_Minh',
                            })
                          : 'Chưa có thông tin'}
                      </dd>
                    </div>
                  </dl>
                )}
                <ReturnFlowers slot={slot} sellerId={sellerId} />
                <ReportFault slot={slot} sellerId={sellerId} />
              </div>
            </details>
          </li>
        ))}
      </ul>
    </section>
  );
}
