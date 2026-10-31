'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { Button } from '@florabot/ui';
import { queryClient } from '@/shared/lib/api';
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
      <div className="product-editor-grid">
        <section
          className="product-editor-card product-editor-overview"
          aria-label={`Tổng quan ${product.name}`}
        >
          <div className="product-editor-card-header">
            <h4>Thông tin, Kích thước &amp; Hình ảnh</h4>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowMetadataEditor(true)}
              disabled={!canEdit}
              aria-expanded={showMetadataEditor}
              aria-controls={`edit-section-${product.id}`}
              className="product-card-edit-btn"
            >
              Chỉnh sửa thông tin
            </Button>
          </div>
          <p className="product-editor-desc">
            {product.description || 'Shop chưa thêm mô tả chi tiết cho mẫu hoa này.'}
          </p>

          <dl className="product-specs-list">
            <div>
              <dt>Kích thước đóng gói</dt>
              <dd>
                {product.lengthCm && product.widthCm && product.heightCm
                  ? `${product.lengthCm} × ${product.widthCm} × ${product.heightCm} cm (Dài × Rộng × Cao)`
                  : 'Chưa cập nhật kích thước'}
              </dd>
            </div>
            <div>
              <dt>Loại mẫu hoa</dt>
              <dd>
                {product.inventoryKind === 'ARTIFICIAL'
                  ? 'Hoa giả cao cấp (không áp dụng thời hạn tươi)'
                  : product.inventoryKind === 'LEGACY_FRESH' || product.shelfLifeHours
                    ? `Dữ liệu hoa tươi cũ (hạn bán ${product.shelfLifeHours || 48} giờ)`
                    : 'Hoa thành phẩm'}
              </dd>
            </div>
          </dl>

          {product.tags && product.tags.length > 0 && (
            <div className="product-tags-container" aria-label="Từ khóa">
              <span className="product-tags-title">Từ khóa phân loại:</span>
              <div className="product-tags">
                {product.tags.map((tag) => (
                  <span key={tag} className="product-tag-chip">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          <ProductPhotos
            sellerId={sellerId}
            productId={product.id}
            productName={product.name}
            canEdit={canEdit}
          />
        </section>

        <section
          className="product-editor-card product-editor-commerce"
          aria-label={`Giá và trạng thái ${product.name}`}
        >
          <div className="product-editor-card-header">
            <h4>Giá bán &amp; Trạng thái</h4>
          </div>
          <p className="price-snapshot-note">
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
              <label htmlFor={inputId}>Giá bán niêm yết (VNĐ)</label>
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
              {price.isSuccess && (
                <p role="status" className="product-form-success">
                  Đã cập nhật giá bán mới.
                </p>
              )}
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
              <label htmlFor={`status-${product.id}`}>Trạng thái kinh doanh</label>
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
                <Button
                  type="submit"
                  variant="outline"
                  disabled={!canEdit || availability.isPending}
                >
                  {availability.isPending ? 'Đang lưu…' : 'Lưu trạng thái'}
                </Button>
              </div>
              {availability.isSuccess && (
                <p role="status" className="product-form-success">
                  Đã cập nhật trạng thái sản phẩm.
                </p>
              )}
              {availability.error && (
                <p role="alert" className="error">
                  {errorText(availability.error)}
                </p>
              )}
            </form>
          </div>
        </section>
      </div>

      {showMetadataEditor && (
        <Modal
          open
          size="lg"
          className="product-form-modal"
          title={`Chỉnh sửa ${product.name}`}
          description="Cập nhật thông tin, giá niêm yết và kích thước đóng gói của mẫu hoa."
          onClose={() => setShowMetadataEditor(false)}
        >
          <div id={`edit-section-${product.id}`} className="product-edit-section">
            <ProductMetadataEditor
              product={product}
              sellerId={sellerId}
              canEdit={canEdit}
              onSuccess={() => setShowMetadataEditor(false)}
              onCancel={() => setShowMetadataEditor(false)}
            />
          </div>
        </Modal>
      )}
    </div>
  );
}
