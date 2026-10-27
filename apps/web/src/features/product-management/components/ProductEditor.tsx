'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { Button } from '@florabot/ui';
import { queryClient } from '../../../api';
import { Modal } from '../../../shared/components/Modal';
import { updateProductPrice, setProductStatus } from '../product.api';
import { priceSchema } from '../product.schemas';
import type { Product } from '../product.types';
import { statusNames } from '../product.types';
import { errorText } from '../product.utils';
import ProductPhotos from './ProductPhotos';
import { ProductMetadataEditor } from './ProductCatalogForm';

export default function ProductEditor({
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
  const [showMetadataEditor, setShowMetadataEditor] = useState(false);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['products', sellerId] });

  const price = useMutation({
    mutationFn: (value: number) => updateProductPrice(sellerId, product.id, value),
    onSuccess: refresh,
  });

  const availability = useMutation({
    mutationFn: () => setProductStatus(product.id, status),
    onSuccess: refresh,
  });

  const inputId = `price-${product.id}`;

  return (
    <div className="product-editor">
      <section className="product-editor-overview" aria-label={`Tổng quan ${product.name}`}>
        <p>{product.description || 'Shop chưa thêm mô tả cho sản phẩm này.'}</p>
        {product.inventoryKind === 'ARTIFICIAL' ? (
          <p className="quiet product-artificial-notice">
            Bó hoa giả cao cấp — không áp dụng thời hạn tươi.
          </p>
        ) : product.inventoryKind === 'LEGACY_FRESH' || product.shelfLifeHours ? (
          <p className="quiet product-legacy-notice">
            Dữ liệu hoa tươi cũ (chuyển tiếp) — Hạn bán theo sản phẩm: {product.shelfLifeHours} giờ.
          </p>
        ) : null}
        {product.lengthCm && product.widthCm && product.heightCm ? (
          <p className="quiet product-dimensions">
            Kích thước: {product.lengthCm} × {product.widthCm} × {product.heightCm} cm (Dài × Rộng ×
            Cao)
          </p>
        ) : null}
        {product.tags && product.tags.length > 0 ? (
          <div className="product-tags" aria-label="Từ khóa">
            {product.tags.map((tag) => (
              <span key={tag} className="product-tag-chip">
                #{tag}
              </span>
            ))}
          </div>
        ) : null}
      </section>

      <section className="product-editor-commerce" aria-label={`Giá và trạng thái ${product.name}`}>
        <p className="quiet price-snapshot-note">
          Lưu ý: Thay đổi giá áp dụng cho các lần nạp hoa tiếp theo, không thay đổi giá của bó hoa
          đang bán trong tủ hoặc đơn đặt trước đã tạo.
        </p>
        <div className="product-quick-actions">
          <form
            noValidate
            onSubmit={form.handleSubmit((values) => price.mutate(values.price))}
            aria-label={`Đổi giá ${product.name}`}
            className="product-inline-form"
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
            className="product-inline-form"
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
        </div>
      </section>

      <div className="product-edit-toggle">
        <Button
          type="button"
          variant="outline"
          onClick={() => setShowMetadataEditor(true)}
          disabled={!canEdit}
          aria-expanded={showMetadataEditor}
          aria-controls={`edit-section-${product.id}`}
        >
          Chỉnh sửa thông tin &amp; kích thước
        </Button>
      </div>
      {showMetadataEditor && (
        <Modal
          open
          title={`Chỉnh sửa ${product.name}`}
          description="Cập nhật thông tin và kích thước của mẫu hoa."
          onClose={() => setShowMetadataEditor(false)}
        >
          <div id={`edit-section-${product.id}`} className="product-edit-section">
            <ProductMetadataEditor product={product} sellerId={sellerId} canEdit={canEdit} />
          </div>
        </Modal>
      )}
      <ProductPhotos
        sellerId={sellerId}
        productId={product.id}
        productName={product.name}
        canEdit={canEdit}
      />
    </div>
  );
}
