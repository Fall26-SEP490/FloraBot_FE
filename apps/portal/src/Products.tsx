import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, Plus, Minus } from '@florabot/ui';
import { money } from '@florabot/contracts';
import type { components } from '../../../packages/contracts/src/generated/api';
import { ApiError, queryClient, request, type Session } from './api';
import ProductPhotos from './ProductPhotos';

type Product = components['schemas']['ProductResponse'];
const priceSchema = z.object({
  price: z
    .number('Nhập giá bán bằng số.')
    .int('Giá bán phải là số nguyên.')
    .positive('Giá bán phải lớn hơn 0.')
    .max(Number.MAX_SAFE_INTEGER, 'Giá bán vượt giới hạn cho phép.'),
});
const statusNames: Record<string, string> = {
  ACTIVE: 'Đang bán',
  INACTIVE: 'Ngừng bán',
  DRAFT: 'Bản nháp',
};
const errorText = (error: Error) =>
  error instanceof ApiError
    ? error.message
    : 'Mất kết nối. Thông tin đã nhập vẫn được giữ, hãy thử lại.';

function ProductEditor({
  product,
  sellerId,
  canEdit,
}: {
  product: Product;
  sellerId: string;
  canEdit: boolean;
}) {
  const form = useForm<z.infer<typeof priceSchema>>({
    resolver: zodResolver(priceSchema),
    defaultValues: { price: Number(product.price) },
  });
  const [status, setStatus] = useState(product.status);
  const base = `/sellers/${sellerId}/flows/`;
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['products', sellerId] });
  const price = useMutation({
    mutationFn: (value: number) =>
      request(base + 'update_product_price', {
        p_product: product.id,
        p_price: value,
      } satisfies components['schemas']['UpdateProductPriceRequest']),
    onSuccess: refresh,
  });
  const availability = useMutation({
    mutationFn: () =>
      request(base + 'set_product_status', {
        p_product: product.id,
        p_status: status,
      } satisfies components['schemas']['SetProductStatusRequest']),
    onSuccess: refresh,
  });
  const inputId = `price-${product.id}`;
  return (
    <div className="product-editor">
      <p>{product.description || 'Shop chưa thêm mô tả cho sản phẩm này.'}</p>
      <p className="quiet">Hạn bán theo sản phẩm: {product.shelfLifeHours} giờ.</p>
      <form
        noValidate
        onSubmit={form.handleSubmit((values) => price.mutate(values.price))}
        aria-label={`Đổi giá ${product.name}`}
      >
        <label htmlFor={inputId}>Giá bán (đồng)</label>
        <div className="field-action">
          <input
            id={inputId}
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            {...form.register('price', { valueAsNumber: true })}
            disabled={!canEdit || price.isPending}
            aria-invalid={!!form.formState.errors.price}
            aria-describedby={form.formState.errors.price ? `${inputId}-error` : undefined}
          />
          <Button type="submit" disabled={!canEdit || price.isPending}>
            {price.isPending ? 'Đang lưu…' : 'Lưu giá'}
          </Button>
        </div>
        {form.formState.errors.price && (
          <p className="error" id={`${inputId}-error`}>
            {form.formState.errors.price.message}
          </p>
        )}
        <p role="status">{price.isSuccess ? 'Đã lưu giá bán.' : ''}</p>
        {price.error && (
          <p role="alert" className="error">
            {errorText(price.error)}
          </p>
        )}
      </form>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          availability.mutate();
        }}
        aria-label={`Trạng thái ${product.name}`}
      >
        <label htmlFor={`status-${product.id}`}>Trạng thái sản phẩm</label>
        <div className="field-action">
          <select
            id={`status-${product.id}`}
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            disabled={!canEdit || availability.isPending}
          >
            {Object.entries(statusNames).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <Button type="submit" variant="outline" disabled={!canEdit || availability.isPending}>
            {availability.isPending ? 'Đang lưu…' : 'Lưu trạng thái'}
          </Button>
        </div>
        <p role="status">{availability.isSuccess ? 'Đã lưu trạng thái sản phẩm.' : ''}</p>
        {availability.error && (
          <p role="alert" className="error">
            {errorText(availability.error)}
          </p>
        )}
      </form>
      <ProductPhotos
        sellerId={sellerId}
        productId={product.id}
        productName={product.name}
        canEdit={canEdit}
      />
    </div>
  );
}

export default function Products({ session }: { session: Session }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('ALL');
  const sellerId = session.sellerId;
  const query = useQuery({
    queryKey: ['products', sellerId],
    queryFn: () => request<Product[]>(`/sellers/${sellerId}/products`),
    enabled: !!sellerId,
  });
  if (!sellerId)
    return <p role="alert">Tài khoản chưa gắn với shop. Vui lòng liên hệ đội ngũ vận hành.</p>;
  const canEdit = session.sellerStatus === 'ACTIVE';
  const products = query.data?.filter(
    (product) =>
      product.name.toLocaleLowerCase('vi').includes(search.trim().toLocaleLowerCase('vi')) &&
      (filter === 'ALL' || filter === product.status),
  );
  return (
    <section className="products" aria-labelledby="products-title">
      <h2 id="products-title">Những bó hoa của shop</h2>
      <p>Chọn một sản phẩm để xem mô tả, điều chỉnh giá hoặc tạm ngừng bán.</p>
      {!canEdit && (
        <p className="quiet">
          Shop cần có gói đang hoạt động để chỉnh sửa sản phẩm. Bạn vẫn có thể xem danh sách.
        </p>
      )}
      <div className="product-filters">
        <div>
          <label htmlFor="product-search">Tìm tên sản phẩm</label>
          <input
            id="product-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div>
          <label htmlFor="product-filter">Lọc trạng thái</label>
          <select
            id="product-filter"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          >
            <option value="ALL">Tất cả trạng thái</option>
            {Object.entries(statusNames).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>
      {query.isPending && <p role="status">Đang tải sản phẩm…</p>}
      {query.error && (
        <div>
          <p role="alert" className="error">
            {errorText(query.error)}
          </p>
          <Button variant="outline" onClick={() => void query.refetch()}>
            Tải lại sản phẩm
          </Button>
        </div>
      )}
      {products?.length === 0 && (
        <p role="status">
          {query.data?.length
            ? 'Không có sản phẩm phù hợp. Thử tên khác hoặc chọn tất cả trạng thái.'
            : 'Shop chưa có sản phẩm. Liên hệ đội ngũ để hoàn tất danh mục trước khi nạp hoa.'}
        </p>
      )}
      <ul className="product-list">
        {products?.map((product) => (
          <li key={product.id}>
            <details>
              <summary>
                <span>
                  <strong>{product.name}</strong>
                  <span className="product-status">
                    {statusNames[product.status] || product.status}
                  </span>
                </span>
                <span className="product-price">{money(Number(product.price))}</span>
                <Plus className="expand-icon" size={20} aria-hidden="true" />
                <Minus className="collapse-icon" size={20} aria-hidden="true" />
              </summary>
              <ProductEditor product={product} sellerId={sellerId} canEdit={canEdit} />
            </details>
          </li>
        ))}
      </ul>
    </section>
  );
}
