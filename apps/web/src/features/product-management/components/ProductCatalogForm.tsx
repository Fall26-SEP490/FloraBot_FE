'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@florabot/ui';
import { queryClient } from '@/shared/lib/api';
import { postProduct, putProduct } from '../product.api';
import {
  productMetadataSchema,
  productCreateSchema,
  type ProductFormValues,
  type ProductCreateFormValues,
} from '../product.schemas';
import type {
  ProductItem,
  CreateProductInput,
  UpdateProductMetadataInput,
  ProductKioskOption,
} from '../product.types';
import { parseTags, errorText } from '../product.utils';

export function ProductCreateForm({
  sellerId,
  kiosks,
  canEdit,
  onSuccess,
  onCancel,
}: {
  sellerId: string;
  kiosks: ProductKioskOption[];
  canEdit: boolean;
  onSuccess?: (createdProductId?: string) => void;
  onCancel?: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const form = useForm<ProductCreateFormValues>({
    resolver: zodResolver(productCreateSchema),
    mode: 'onBlur',
    reValidateMode: 'onChange',
    defaultValues: {
      kioskId: kiosks.length === 1 ? kiosks[0].id : '',
      name: '',
      description: '',
      price: '' as unknown as number,
      lengthCm: '' as unknown as number,
      widthCm: '' as unknown as number,
      heightCm: '' as unknown as number,
      tagsInput: '',
    },
  });

  const onSubmit = async (values: ProductCreateFormValues) => {
    if (submitting) return;
    setSubmitting(true);
    setServerError(null);
    setSuccessMessage(null);
    try {
      const payload: CreateProductInput = {
        kioskId: values.kioskId,
        name: values.name.trim(),
        description: values.description ? values.description.trim() : '',
        price: values.price,
        tags: parseTags(values.tagsInput),
        lengthCm: values.lengthCm,
        widthCm: values.widthCm,
        heightCm: values.heightCm,
      };
      const created = await postProduct(payload);
      await queryClient.invalidateQueries({ queryKey: ['products', sellerId] });
      setSuccessMessage('Đã tạo mẫu hoa giả mới ở trạng thái Bản nháp.');
      form.reset();
      if (onSuccess) onSuccess(created?.id);
    } catch (err) {
      setServerError(errorText(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      className="product-catalog-form"
      noValidate
      onSubmit={form.handleSubmit(onSubmit)}
      aria-label="Thêm mẫu hoa giả mới"
    >
      <h3 className="sr-only">Thêm mẫu hoa giả mới</h3>
      <div className="product-form-badge-strip">
        <span className="product-badge-pill">Bản nháp (DRAFT)</span>
        <span className="product-badge-note">
          Hoa giả không áp dụng thời hạn tươi · Bạn có thể tải ảnh và mở bán sau khi tạo.
        </span>
      </div>

      <div className="form-grid-2">
        <div className="form-field">
          <label htmlFor="create-product-name">Tên mẫu hoa</label>
          <input
            id="create-product-name"
            type="text"
            maxLength={120}
            placeholder="Nhập tên mẫu hoa (tối đa 120 ký tự)"
            disabled={!canEdit || submitting}
            {...form.register('name')}
            aria-invalid={!!form.formState.errors.name}
            aria-describedby={form.formState.errors.name ? 'create-product-name-error' : undefined}
          />
          <p className="quiet field-subhint">Tên hiển thị trên website và hóa đơn nhận hoa.</p>
          {form.formState.errors.name && (
            <p className="error" id="create-product-name-error">
              {form.formState.errors.name.message}
            </p>
          )}
        </div>

        <div className="form-field">
          <label htmlFor="create-product-kiosk">Kiosk của shop</label>
          <select
            id="create-product-kiosk"
            disabled={!canEdit || submitting || kiosks.length === 0}
            {...form.register('kioskId')}
            aria-invalid={!!form.formState.errors.kioskId}
            aria-describedby="create-product-kiosk-help create-product-kiosk-error"
          >
            <option value="">Chọn kiosk</option>
            {kiosks.map((kiosk) => (
              <option key={kiosk.id} value={kiosk.id}>
                {kiosk.name} · {kiosk.code}
              </option>
            ))}
          </select>
          <p className="quiet field-subhint" id="create-product-kiosk-help">
            Kiosk xác nhận quyền tạo mẫu; chọn ô nạp hoa tại màn “Hoa tại kiosk”.
          </p>
          {form.formState.errors.kioskId && (
            <p className="error" id="create-product-kiosk-error">
              {form.formState.errors.kioskId.message}
            </p>
          )}
        </div>
      </div>

      <div className="form-grid-2">
        <div className="form-field">
          <label htmlFor="create-product-price">Giá bán niêm yết (VNĐ)</label>
          <input
            id="create-product-price"
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            placeholder="Nhập giá bán bằng số nguyên"
            disabled={!canEdit || submitting}
            {...form.register('price', { valueAsNumber: true })}
            aria-invalid={!!form.formState.errors.price}
            aria-describedby={
              form.formState.errors.price ? 'create-product-price-error' : undefined
            }
          />
          {form.formState.errors.price && (
            <p className="error" id="create-product-price-error">
              {form.formState.errors.price.message}
            </p>
          )}
        </div>

        <div className="form-field">
          <label htmlFor="create-product-tags">Từ khóa tìm kiếm (phân cách bằng dấu phẩy)</label>
          <input
            id="create-product-tags"
            type="text"
            placeholder="hoa hồng, hoa lụa, quà tặng"
            disabled={!canEdit || submitting}
            {...form.register('tagsInput')}
            aria-invalid={!!form.formState.errors.tagsInput}
            aria-describedby={
              form.formState.errors.tagsInput ? 'create-product-tags-error' : undefined
            }
          />
          {form.formState.errors.tagsInput && (
            <p className="error" id="create-product-tags-error">
              {form.formState.errors.tagsInput.message}
            </p>
          )}
        </div>
      </div>

      <fieldset className="dimensions-fieldset">
        <legend>Kích thước đóng gói bao gồm bao bì (Dài × Rộng × Cao - cm)</legend>
        <div className="dimensions-grid">
          <div className="form-field">
            <label htmlFor="create-product-length">Dài (cm)</label>
            <input
              id="create-product-length"
              type="number"
              min="0.01"
              max="1000"
              step="0.01"
              placeholder="VD: 25"
              disabled={!canEdit || submitting}
              {...form.register('lengthCm', { valueAsNumber: true })}
              aria-invalid={!!form.formState.errors.lengthCm}
              aria-describedby={
                form.formState.errors.lengthCm ? 'create-product-length-error' : undefined
              }
            />
            {form.formState.errors.lengthCm && (
              <p className="error" id="create-product-length-error">
                {form.formState.errors.lengthCm.message}
              </p>
            )}
          </div>

          <div className="form-field">
            <label htmlFor="create-product-width">Rộng (cm)</label>
            <input
              id="create-product-width"
              type="number"
              min="0.01"
              max="1000"
              step="0.01"
              placeholder="VD: 15"
              disabled={!canEdit || submitting}
              {...form.register('widthCm', { valueAsNumber: true })}
              aria-invalid={!!form.formState.errors.widthCm}
              aria-describedby={
                form.formState.errors.widthCm ? 'create-product-width-error' : undefined
              }
            />
            {form.formState.errors.widthCm && (
              <p className="error" id="create-product-width-error">
                {form.formState.errors.widthCm.message}
              </p>
            )}
          </div>

          <div className="form-field">
            <label htmlFor="create-product-height">Cao (cm)</label>
            <input
              id="create-product-height"
              type="number"
              min="0.01"
              max="1000"
              step="0.01"
              placeholder="VD: 30"
              disabled={!canEdit || submitting}
              {...form.register('heightCm', { valueAsNumber: true })}
              aria-invalid={!!form.formState.errors.heightCm}
              aria-describedby={
                form.formState.errors.heightCm ? 'create-product-height-error' : undefined
              }
            />
            {form.formState.errors.heightCm && (
              <p className="error" id="create-product-height-error">
                {form.formState.errors.heightCm.message}
              </p>
            )}
          </div>
        </div>
      </fieldset>

      <div className="form-field">
        <label htmlFor="create-product-description">Mô tả sản phẩm</label>
        <textarea
          id="create-product-description"
          rows={2}
          maxLength={2000}
          placeholder="Mô tả phong cách, chất liệu bó hoa giả cao cấp…"
          disabled={!canEdit || submitting}
          {...form.register('description')}
          aria-invalid={!!form.formState.errors.description}
          aria-describedby={
            form.formState.errors.description ? 'create-product-desc-error' : undefined
          }
        />
        {form.formState.errors.description && (
          <p className="error" id="create-product-desc-error">
            {form.formState.errors.description.message}
          </p>
        )}
      </div>

      {successMessage && (
        <p role="status" className="product-form-success">
          {successMessage}
        </p>
      )}
      {serverError && (
        <p role="alert" className="error">
          {serverError}
        </p>
      )}

      <div className="form-actions">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
            Hủy
          </Button>
        )}
        <Button type="submit" disabled={!canEdit || submitting || kiosks.length === 0}>
          {submitting ? 'Đang tạo mẫu hoa…' : 'Tạo mẫu hoa'}
        </Button>
      </div>
    </form>
  );
}

export function ProductMetadataEditor({
  product,
  sellerId,
  canEdit,
  onSuccess,
  onCancel,
}: {
  product: ProductItem;
  sellerId: string;
  canEdit: boolean;
  onSuccess?: () => void;
  onCancel?: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productMetadataSchema),
    defaultValues: {
      name: product.name,
      description: product.description ?? '',
      price: Number(product.price),
      lengthCm: (product.lengthCm != null ? Number(product.lengthCm) : '') as unknown as number,
      widthCm: (product.widthCm != null ? Number(product.widthCm) : '') as unknown as number,
      heightCm: (product.heightCm != null ? Number(product.heightCm) : '') as unknown as number,
      tagsInput: (product.tags || []).join(', '),
    },
  });

  const onSubmit = async (values: ProductFormValues) => {
    if (submitting) return;
    setSubmitting(true);
    setServerError(null);
    setSuccessMessage(null);
    try {
      const payload: UpdateProductMetadataInput = {
        name: values.name.trim(),
        description: values.description ? values.description.trim() : '',
        price: values.price,
        tags: parseTags(values.tagsInput),
        lengthCm: values.lengthCm,
        widthCm: values.widthCm,
        heightCm: values.heightCm,
      };
      await putProduct(sellerId, product.id, payload);
      await queryClient.invalidateQueries({ queryKey: ['products', sellerId] });
      setSuccessMessage('Đã cập nhật chi tiết mẫu hoa thành công.');
      if (onSuccess) onSuccess();
    } catch (err) {
      setServerError(errorText(err));
    } finally {
      setSubmitting(false);
    }
  };

  const idPrefix = `edit-${product.id}`;

  return (
    <form
      className="product-metadata-editor"
      noValidate
      onSubmit={form.handleSubmit(onSubmit)}
      aria-label={`Chỉnh sửa thông tin ${product.name}`}
    >
      <p className="price-snapshot-note">
        Lưu ý: Thay đổi giá áp dụng cho các lần nạp hoa tiếp theo, không thay đổi giá của bó hoa
        đang bán trong tủ hoặc đơn đặt trước đã tạo.
      </p>

      <div className="form-grid-2">
        <div className="form-field">
          <label htmlFor={`${idPrefix}-name`}>Tên mẫu hoa</label>
          <input
            id={`${idPrefix}-name`}
            type="text"
            maxLength={120}
            placeholder="Nhập tên mẫu hoa (tối đa 120 ký tự)"
            disabled={!canEdit || submitting}
            {...form.register('name')}
            aria-invalid={!!form.formState.errors.name}
            aria-describedby={form.formState.errors.name ? `${idPrefix}-name-error` : undefined}
          />
          {form.formState.errors.name && (
            <p className="error" id={`${idPrefix}-name-error`}>
              {form.formState.errors.name.message}
            </p>
          )}
        </div>

        <div className="form-field">
          <label htmlFor={`${idPrefix}-price`}>Giá bán niêm yết (VNĐ)</label>
          <input
            id={`${idPrefix}-price`}
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            placeholder="Nhập giá bán bằng số nguyên"
            disabled={!canEdit || submitting}
            {...form.register('price', { valueAsNumber: true })}
            aria-invalid={!!form.formState.errors.price}
            aria-describedby={form.formState.errors.price ? `${idPrefix}-price-error` : undefined}
          />
          {form.formState.errors.price && (
            <p className="error" id={`${idPrefix}-price-error`}>
              {form.formState.errors.price.message}
            </p>
          )}
        </div>
      </div>

      <div className="form-field">
        <label htmlFor={`${idPrefix}-tags`}>Từ khóa tìm kiếm (phân cách bằng dấu phẩy)</label>
        <input
          id={`${idPrefix}-tags`}
          type="text"
          placeholder="hoa hồng, hoa lụa, quà tặng"
          disabled={!canEdit || submitting}
          {...form.register('tagsInput')}
          aria-invalid={!!form.formState.errors.tagsInput}
          aria-describedby={form.formState.errors.tagsInput ? `${idPrefix}-tags-error` : undefined}
        />
        {form.formState.errors.tagsInput && (
          <p className="error" id={`${idPrefix}-tags-error`}>
            {form.formState.errors.tagsInput.message}
          </p>
        )}
      </div>

      <fieldset className="dimensions-fieldset">
        <legend>Kích thước đóng gói bao gồm bao bì (Dài × Rộng × Cao - cm)</legend>
        <div className="dimensions-grid">
          <div className="form-field">
            <label htmlFor={`${idPrefix}-length`}>Dài (cm)</label>
            <input
              id={`${idPrefix}-length`}
              type="number"
              min="0.01"
              max="1000"
              step="0.01"
              placeholder="Dài cm"
              disabled={!canEdit || submitting}
              {...form.register('lengthCm', { valueAsNumber: true })}
              aria-invalid={!!form.formState.errors.lengthCm}
              aria-describedby={
                form.formState.errors.lengthCm ? `${idPrefix}-length-error` : undefined
              }
            />
            {form.formState.errors.lengthCm && (
              <p className="error" id={`${idPrefix}-length-error`}>
                {form.formState.errors.lengthCm.message}
              </p>
            )}
          </div>

          <div className="form-field">
            <label htmlFor={`${idPrefix}-width`}>Rộng (cm)</label>
            <input
              id={`${idPrefix}-width`}
              type="number"
              min="0.01"
              max="1000"
              step="0.01"
              placeholder="Rộng cm"
              disabled={!canEdit || submitting}
              {...form.register('widthCm', { valueAsNumber: true })}
              aria-invalid={!!form.formState.errors.widthCm}
              aria-describedby={
                form.formState.errors.widthCm ? `${idPrefix}-width-error` : undefined
              }
            />
            {form.formState.errors.widthCm && (
              <p className="error" id={`${idPrefix}-width-error`}>
                {form.formState.errors.widthCm.message}
              </p>
            )}
          </div>

          <div className="form-field">
            <label htmlFor={`${idPrefix}-height`}>Cao (cm)</label>
            <input
              id={`${idPrefix}-height`}
              type="number"
              min="0.01"
              max="1000"
              step="0.01"
              placeholder="Cao cm"
              disabled={!canEdit || submitting}
              {...form.register('heightCm', { valueAsNumber: true })}
              aria-invalid={!!form.formState.errors.heightCm}
              aria-describedby={
                form.formState.errors.heightCm ? `${idPrefix}-height-error` : undefined
              }
            />
            {form.formState.errors.heightCm && (
              <p className="error" id={`${idPrefix}-height-error`}>
                {form.formState.errors.heightCm.message}
              </p>
            )}
          </div>
        </div>
      </fieldset>

      <div className="form-field">
        <label htmlFor={`${idPrefix}-description`}>Mô tả chi tiết</label>
        <textarea
          id={`${idPrefix}-description`}
          rows={2}
          maxLength={2000}
          placeholder="Mô tả phong cách, chất liệu bó hoa giả cao cấp…"
          disabled={!canEdit || submitting}
          {...form.register('description')}
          aria-invalid={!!form.formState.errors.description}
          aria-describedby={
            form.formState.errors.description ? `${idPrefix}-desc-error` : undefined
          }
        />
        {form.formState.errors.description && (
          <p className="error" id={`${idPrefix}-desc-error`}>
            {form.formState.errors.description.message}
          </p>
        )}
      </div>

      {successMessage && (
        <p role="status" className="product-form-success">
          {successMessage}
        </p>
      )}
      {serverError && (
        <p role="alert" className="error">
          {serverError}
        </p>
      )}

      <div className="form-actions">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
            Hủy
          </Button>
        )}
        <Button type="submit" disabled={!canEdit || submitting}>
          {submitting ? 'Đang lưu chi tiết…' : 'Lưu chi tiết mẫu hoa'}
        </Button>
      </div>
    </form>
  );
}
