'use client';

import { useState } from 'react';
import { Controller, useController, useForm, type SubmitErrorHandler } from 'react-hook-form';
import { FlowerTagFields } from './FlowerTagFields';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, ChevronDown } from '@florabot/ui';
import { flowerColors, flowerTags, tagIsKnown } from '@/shared/lib/flower-tags';
import { queryClient } from '@/shared/lib/api';
import { postProduct, putProduct } from '../product.api';
import {
  productMetadataSchema,
  productCreateSchema,
  REQUIRED_FLOWER_TAGS_MESSAGE,
  type ProductFormValues,
  type ProductCreateFormValues,
} from '../product.schemas';
import type { ProductItem, CreateProductInput, UpdateProductMetadataInput } from '../product.types';
import { parseTags, errorText } from '../product.utils';

function formatPriceDisplay(value: unknown): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '';
  return new Intl.NumberFormat('vi-VN').format(value);
}

function parsePriceInput(raw: string): number {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return Number.NaN;
  const parsed = Number(digits);
  return Number.isSafeInteger(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

export function ProductCreateForm({
  sellerId,
  canEdit,
  onSuccess,
  onCancel,
}: {
  sellerId: string;
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
    shouldFocusError: false,
    defaultValues: {
      name: '',
      description: '',
      price: '' as unknown as number,
      lengthCm: '' as unknown as number,
      widthCm: '' as unknown as number,
      heightCm: '' as unknown as number,
      tagsInput: '',
      quantity: 0,
    },
  });

  const { field: tags } = useController({ control: form.control, name: 'tagsInput' });
  const { errors } = form.formState;
  const parsedTags = parseTags(tags.value);
  const missingGroups = [
    ...(!parsedTags.some((tag) => tagIsKnown(tag, 'flower', flowerTags))
      ? ['flower' as const]
      : []),
    ...(!parsedTags.some((tag) => tagIsKnown(tag, 'color', flowerColors))
      ? ['color' as const]
      : []),
  ];
  const classificationError = errors.tagsInput?.message === REQUIRED_FLOWER_TAGS_MESSAGE;
  const tagsErrorId = errors.tagsInput ? 'create-product-tags-error' : undefined;
  const tagProps = {
    id: 'create-product-tags',
    value: tags.value,
    onChange: tags.onChange,
    disabled: !canEdit || submitting,
  };

  const onInvalid: SubmitErrorHandler<ProductCreateFormValues> = (invalid) => {
    const firstMain = (['name', 'price', 'quantity'] as const).find((field) => invalid[field]);
    if (firstMain) return form.setFocus(firstMain);
    if (invalid.tagsInput?.message === REQUIRED_FLOWER_TAGS_MESSAGE) {
      document
        .querySelector<HTMLButtonElement>(`#create-product-tags-${missingGroups[0]} button`)
        ?.focus();
      return;
    }
    const dimension = (['lengthCm', 'widthCm', 'heightCm'] as const).find(
      (field) => invalid[field],
    );
    if (dimension) return form.setFocus(dimension);
    const extras = document.querySelector<HTMLDetailsElement>('#create-product-extras');
    if (extras) extras.open = true;
    if (invalid.description) form.setFocus('description');
    else document.getElementById('create-product-tags')?.focus();
  };

  const onSubmit = async (values: ProductCreateFormValues) => {
    if (submitting) return;
    setSubmitting(true);
    setServerError(null);
    setSuccessMessage(null);
    try {
      const payload: CreateProductInput = {
        name: values.name.trim(),
        description: values.description ? values.description.trim() : '',
        price: values.price,
        tags: parseTags(values.tagsInput),
        lengthCm: values.lengthCm,
        widthCm: values.widthCm,
        heightCm: values.heightCm,
        quantity: values.quantity,
      };
      const created = await postProduct(payload);
      await queryClient.invalidateQueries({ queryKey: ['products', sellerId] });
      setSuccessMessage('Đã tạo mẫu hoa mới ở trạng thái Bản mẫu.');
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
      onSubmit={form.handleSubmit(onSubmit, onInvalid)}
      aria-label="Thêm mẫu hoa mới"
    >
      <h3 className="sr-only">Thêm mẫu hoa mới</h3>
      <div className="product-form-badge-strip">
        <span className="product-badge-pill">Bản mẫu</span>
        <span className="product-badge-note">Thêm ảnh và bật bán sau khi tạo.</span>
      </div>

      <div>
        <div className="form-field">
          <label htmlFor="create-product-name">Tên mẫu hoa</label>
          <input
            id="create-product-name"
            type="text"
            maxLength={120}
            placeholder="Ví dụ: Bó hồng pastel"
            disabled={!canEdit || submitting}
            {...form.register('name')}
            aria-invalid={!!form.formState.errors.name}
            aria-describedby={form.formState.errors.name ? 'create-product-name-error' : undefined}
          />
          {form.formState.errors.name && (
            <p className="error" id="create-product-name-error">
              {form.formState.errors.name.message}
            </p>
          )}
        </div>
      </div>

      <div className="form-grid-2">
        <div className="form-field">
          <label htmlFor="create-product-price">Giá bán (VNĐ)</label>
          <Controller
            control={form.control}
            name="price"
            render={({ field }) => (
              <div className="product-price-input">
                <input
                  id="create-product-price"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="Ví dụ: 250.000"
                  disabled={!canEdit || submitting}
                  name={field.name}
                  ref={field.ref}
                  value={formatPriceDisplay(field.value)}
                  onChange={(event) => field.onChange(parsePriceInput(event.target.value))}
                  onBlur={field.onBlur}
                  aria-invalid={!!form.formState.errors.price}
                  aria-describedby={
                    form.formState.errors.price ? 'create-product-price-error' : undefined
                  }
                />
                <span className="product-price-unit" aria-hidden="true">
                  ₫
                </span>
              </div>
            )}
          />
          {form.formState.errors.price && (
            <p className="error" id="create-product-price-error">
              {form.formState.errors.price.message}
            </p>
          )}
        </div>

        <div className="form-field">
          <label htmlFor="create-product-quantity">Tồn bó tại shop</label>
          <input
            id="create-product-quantity"
            type="number"
            min="0"
            max="2147483647"
            step="1"
            inputMode="numeric"
            disabled={!canEdit || submitting}
            {...form.register('quantity', { valueAsNumber: true })}
            aria-invalid={!!form.formState.errors.quantity}
            aria-describedby={
              form.formState.errors.quantity ? 'create-product-quantity-error' : undefined
            }
          />
          {form.formState.errors.quantity && (
            <p className="error" id="create-product-quantity-error">
              {form.formState.errors.quantity.message}
            </p>
          )}
        </div>
      </div>

      <div className="product-classification">
        <FlowerTagFields
          {...tagProps}
          section="choices"
          required
          missingGroups={classificationError ? missingGroups : []}
          errorId={classificationError ? tagsErrorId : undefined}
        />
        {classificationError && (
          <p className="error" id={tagsErrorId} role="alert">
            {errors.tagsInput?.message}
          </p>
        )}
      </div>

      <fieldset className="dimensions-fieldset">
        <legend>Kích thước đóng gói</legend>
        <p className="quiet field-subhint">Đo cả bao bì để chọn ô tủ phù hợp.</p>
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

      <details id="create-product-extras" className="product-extra-details">
        <summary>
          <span>
            Thông tin bổ sung <small>(tùy chọn)</small>
          </span>
          <ChevronDown size={16} aria-hidden="true" />
        </summary>
        <div className="product-extra-fields">
          <div className="form-field">
            <label htmlFor="create-product-description">Mô tả sản phẩm</label>
            <textarea
              id="create-product-description"
              rows={2}
              maxLength={2000}
              placeholder="Mô tả phong cách, chất liệu bó hoa…"
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
          <FlowerTagFields
            {...tagProps}
            section="extras"
            errorId={classificationError ? undefined : tagsErrorId}
          />
          {errors.tagsInput && !classificationError && (
            <p className="error" id={tagsErrorId} role="alert">
              {errors.tagsInput.message}
            </p>
          )}
        </div>
      </details>

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
      tagsInput: parseTags((product.tags ?? []).join(',')).join(', '),
      quantity: product.quantity == null ? undefined : Number(product.quantity),
    },
  });

  const { dirtyFields } = form.formState;

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
        ...(dirtyFields.quantity && values.quantity !== undefined
          ? { quantity: values.quantity }
          : {}),
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
        Giá mới áp dụng cho lần nạp tiếp theo. Hoa trong tủ và đơn đã tạo giữ nguyên giá.
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

      <div className="form-field product-edit-quantity">
        <label htmlFor={`${idPrefix}-quantity`}>Tồn bó tại shop</label>
        <input
          id={`${idPrefix}-quantity`}
          type="number"
          min="0"
          max="2147483647"
          step="1"
          inputMode="numeric"
          disabled={!canEdit || submitting}
          {...form.register('quantity', {
            setValueAs: (value: string) => (value === '' ? undefined : Number(value)),
          })}
          aria-invalid={!!form.formState.errors.quantity}
          aria-describedby={`${idPrefix}-quantity-help ${idPrefix}-quantity-error`}
        />
        <p className="quiet field-subhint" id={`${idPrefix}-quantity-help`}>
          Tổng số bó thực tế còn tại shop. Chỉ sửa khi cần điều chỉnh tồn.
        </p>
        {form.formState.errors.quantity && (
          <p className="error" id={`${idPrefix}-quantity-error`}>
            {form.formState.errors.quantity.message}
          </p>
        )}
      </div>

      <div className="form-field">
        <Controller
          control={form.control}
          name="tagsInput"
          render={({ field }) => (
            <FlowerTagFields
              id={`${idPrefix}-tags`}
              value={field.value}
              onChange={field.onChange}
              disabled={!canEdit || submitting}
            />
          )}
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
          placeholder="Mô tả phong cách, chất liệu bó hoa…"
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
