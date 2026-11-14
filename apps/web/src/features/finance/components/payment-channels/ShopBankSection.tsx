'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button } from '@florabot/ui';
import { ApiError, queryClient, request } from '@/shared/lib/api';
import type { components } from '../../../../../../../packages/contracts/src/generated/api';
import '../../styles/shop-bank-section.css';

export type SellerBankResponse = components['schemas']['SellerBankResponse'];
export type SetSellerBankRequest = components['schemas']['SetSellerBankRequest'];

export interface ShopBankSectionProps {
  sellerId: string;
  variant?: 'panel' | 'embedded';
  title?: string;
  sectionId?: string;
  onBankReadyChange?: (isReady: boolean) => void;
}

export function ShopBankSection({
  sellerId,
  variant = 'panel',
  title = 'Tài khoản ngân hàng của shop (Nhận hoàn phí thuê kiosk)',
  sectionId,
  onBankReadyChange,
}: ShopBankSectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [bankName, setBankName] = useState<string | null>(null);
  const [holder, setHolder] = useState<string | null>(null);
  const [accountRaw, setAccountRaw] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const pendingBank = useRef<SetSellerBankRequest | null>(null);

  const bankQuery = useQuery({
    queryKey: ['seller-shop-bank', sellerId],
    queryFn: () => request<SellerBankResponse>(`/sellers/${sellerId}/bank`),
    enabled: Boolean(sellerId),
  });

  const isReady = bankQuery.data?.status === 'READY';

  useEffect(() => {
    if (bankQuery.data) {
      onBankReadyChange?.(bankQuery.data.status === 'READY');
    }
  }, [bankQuery.data, onBankReadyChange]);

  const saveBankMutation = useMutation({
    mutationFn: async () => {
      const payload = pendingBank.current;
      pendingBank.current = null;
      if (!payload) throw new Error('Vui lòng nhập lại số tài khoản.');
      return request<{ success?: boolean }>(
        `/sellers/${sellerId}/flows/set_seller_bank`,
        payload,
        true,
        'POST',
      );
    },
    retry: false,
    gcTime: 0,
    onSuccess: async () => {
      // Clear raw account number immediately from state (never persist in form memory)
      setAccountRaw('');
      setFieldErrors({});
      setActionError('');
      setIsEditing(false);
      setActionSuccess('');
      try {
        const saved = await request<SellerBankResponse>(`/sellers/${sellerId}/bank`);
        queryClient.setQueryData(['seller-shop-bank', sellerId], saved);
        setBankName(null);
        setHolder(null);
        if (saved.status === 'READY') {
          setActionSuccess('Đã lưu thông tin tài khoản ngân hàng của shop thành công.');
        } else if (saved.status !== 'NEEDS_UPDATE') {
          setActionError(
            'Đã gửi thông tin nhưng chưa thấy tài khoản vừa lưu. Vui lòng tải lại thông tin ngân hàng để kiểm tra.',
          );
        }
      } catch {
        setActionError(
          'Đã gửi thông tin nhưng chưa tải lại được tài khoản đã lưu. Chọn “Tải lại thông tin ngân hàng” để kiểm tra trước khi gửi lại.',
        );
      }
    },
    onError: (err: unknown) => {
      setActionSuccess('');
      setActionError(
        err instanceof ApiError
          ? err.message
          : 'Chưa lưu được thông tin ngân hàng shop. Vui lòng kiểm tra lại.',
      );
    },
    onSettled: () => {
      pendingBank.current = null;
      setAccountRaw('');
    },
  });

  function startEditing() {
    setBankName(bankQuery.data?.bankName ?? '');
    setHolder(bankQuery.data?.holder ?? '');
    setAccountRaw('');
    setFieldErrors({});
    setActionError('');
    setActionSuccess('');
    setIsEditing(true);
  }

  function cancelEditing() {
    setAccountRaw('');
    setFieldErrors({});
    setActionError('');
    setIsEditing(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (saveBankMutation.isPending) return;
    setActionError('');
    setActionSuccess('');

    const trimmedBank = (bankName ?? bankQuery.data?.bankName ?? '').trim();
    const trimmedHolder = (holder ?? bankQuery.data?.holder ?? '').trim().toUpperCase();
    const trimmedAccount = accountRaw.trim();

    const errors: Record<string, string> = {};

    if (!trimmedBank || trimmedBank.length < 2) {
      errors.bankName = 'Vui lòng nhập tên ngân hàng (từ 2 ký tự trở lên).';
    } else if (trimmedBank.length > 120) {
      errors.bankName = 'Tên ngân hàng không được quá 120 ký tự.';
    }

    if (!trimmedHolder || trimmedHolder.length < 2) {
      errors.holder = 'Vui lòng nhập tên chủ tài khoản (từ 2 ký tự trở lên).';
    } else if (trimmedHolder.length > 120) {
      errors.holder = 'Tên chủ tài khoản không được quá 120 ký tự.';
    }

    if (!trimmedAccount) {
      errors.accountRaw = 'Vui lòng nhập số tài khoản ngân hàng.';
    } else if (trimmedAccount.length < 4 || trimmedAccount.length > 34) {
      errors.accountRaw = 'Số tài khoản gồm từ 4 đến 34 ký tự.';
    } else if (!/^[A-Za-z0-9]+$/.test(trimmedAccount)) {
      errors.accountRaw = 'Số tài khoản chỉ gồm chữ cái hoặc chữ số, không chứa khoảng trắng.';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    pendingBank.current = {
      p_bank: trimmedBank,
      p_holder: trimmedHolder,
      p_account_enc: trimmedAccount,
    };
    setAccountRaw('');
    saveBankMutation.mutate();
  }

  const showForm = !isReady || isEditing;

  const content = (
    <>
      <div className="business-heading">
        <div>
          <h2 id={`shop-bank-title-${sellerId}`}>{title}</h2>
          <p>Dùng làm thông tin nhận hoàn phí thuê kiosk từ hệ thống và đối soát cửa hàng.</p>
        </div>
        {isReady && !isEditing && (
          <Button type="button" variant="outline" onClick={startEditing}>
            Thay đổi tài khoản
          </Button>
        )}
      </div>

      <aside className="shop-bank-distinction-card" aria-label="Phân biệt tài khoản">
        <div className="shop-bank-distinction-badge">Lưu ý quan trọng</div>
        <p>
          <strong>• Ngân hàng shop:</strong> Dùng làm thông tin nhận hoàn phí thuê kiosk khi có hủy
          đơn hoặc hoàn phí từ Ban quản lý.
        </p>
        <p>
          <strong>• Kênh PayOS Seller:</strong> Dùng nhận tiền bán hoa từ khách mua hoa tại kiosk
          (Kênh PayOS ACTIVE không thay thế ngân hàng shop).
        </p>
        <p>
          <strong>• Tài khoản cá nhân:</strong> Dành cho khiếu nại mua hàng cá nhân tại trang hồ sơ
          người dùng, độc lập và không cập nhật ngân hàng shop.
        </p>
      </aside>

      {bankQuery.isPending && (
        <p role="status" className="shop-bank-loading">
          Đang kiểm tra thông tin ngân hàng shop…
        </p>
      )}

      {bankQuery.isError && (
        <div role="alert" className="shop-bank-alert-box is-error">
          <p>
            {bankQuery.error instanceof ApiError
              ? bankQuery.error.message
              : 'Chưa tải được thông tin ngân hàng shop.'}
          </p>
          <Button type="button" variant="outline" onClick={() => void bankQuery.refetch()}>
            Tải lại
          </Button>
        </div>
      )}

      {actionSuccess && (
        <p role="status" className="shop-bank-alert-box is-success">
          {actionSuccess}
        </p>
      )}

      {actionError && (
        <div role="alert" className="shop-bank-alert-box is-error">
          <p>{actionError}</p>
          <Button type="button" variant="outline" onClick={() => void bankQuery.refetch()}>
            Tải lại thông tin ngân hàng
          </Button>
        </div>
      )}

      {bankQuery.data && !showForm && (
        <div className="shop-bank-ready-card">
          <div className="shop-bank-status-row">
            <span className="status-pill status-ACTIVE">✓ Đã sẵn sàng (READY)</span>
            <span className="shop-bank-status-desc">Hồ sơ ngân hàng đủ điều kiện thuê kiosk</span>
          </div>

          <div className="business-facts shop-bank-facts">
            <div>
              <span>Tên ngân hàng</span>
              <strong>{bankQuery.data.bankName || 'Chưa cập nhật'}</strong>
            </div>
            <div>
              <span>Chủ tài khoản</span>
              <strong>{bankQuery.data.holder || 'Chưa cập nhật'}</strong>
            </div>
            <div>
              <span>Số tài khoản</span>
              <strong>•••• •••• •••• {bankQuery.data.accountSuffix || '••••'}</strong>
            </div>
          </div>
        </div>
      )}

      {bankQuery.data && showForm && (
        <div className="shop-bank-form-wrapper">
          {bankQuery.data.status === 'MISSING' && (
            <div role="status" className="shop-bank-alert-box is-warning">
              <strong>Shop chưa khai báo tài khoản ngân hàng nhận hoàn phí thuê.</strong>
              <p>
                Vui lòng khai báo thông tin bên dưới để đủ điều kiện thuê kiosk mới hoặc bổ sung.
              </p>
            </div>
          )}

          {bankQuery.data.status === 'NEEDS_UPDATE' && (
            <div role="status" className="shop-bank-alert-box is-warning">
              <p>Không đọc được số tài khoản đã lưu. Vui lòng nhập lại để cập nhật.</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="shop-bank-form" noValidate>
            <div className="profile-form-group">
              <label htmlFor={`shop-bank-name-${sellerId}`}>Tên ngân hàng nhận hoàn phí *</label>
              <input
                id={`shop-bank-name-${sellerId}`}
                type="text"
                maxLength={120}
                placeholder="Ví dụ: MB Bank, Vietcombank, Techcombank..."
                value={bankName ?? bankQuery.data?.bankName ?? ''}
                disabled={saveBankMutation.isPending}
                onChange={(e) => {
                  setBankName(e.target.value);
                  if (fieldErrors.bankName) {
                    setFieldErrors((prev) => ({ ...prev, bankName: '' }));
                  }
                }}
                aria-invalid={Boolean(fieldErrors.bankName)}
              />
              {fieldErrors.bankName && (
                <p className="profile-field-error">{fieldErrors.bankName}</p>
              )}
            </div>

            <div className="profile-form-group">
              <label htmlFor={`shop-bank-holder-${sellerId}`}>
                Tên chủ tài khoản (Viết hoa, không dấu hoặc có dấu) *
              </label>
              <input
                id={`shop-bank-holder-${sellerId}`}
                type="text"
                maxLength={120}
                placeholder="Ví dụ: NGUYEN VAN A"
                value={holder ?? bankQuery.data?.holder ?? ''}
                disabled={saveBankMutation.isPending}
                onChange={(e) => {
                  setHolder(e.target.value.toUpperCase());
                  if (fieldErrors.holder) {
                    setFieldErrors((prev) => ({ ...prev, holder: '' }));
                  }
                }}
                aria-invalid={Boolean(fieldErrors.holder)}
              />
              {fieldErrors.holder && <p className="profile-field-error">{fieldErrors.holder}</p>}
            </div>

            <div className="profile-form-group">
              <label htmlFor={`shop-bank-account-${sellerId}`}>Số tài khoản ngân hàng *</label>
              <input
                id={`shop-bank-account-${sellerId}`}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                maxLength={34}
                placeholder="Nhập số tài khoản ngân hàng (4–34 số/chữ, không khoảng trắng)"
                value={accountRaw}
                disabled={saveBankMutation.isPending}
                onChange={(e) => {
                  // Keep only alphanumeric characters without spaces
                  const cleaned = e.target.value.replace(/[^A-Za-z0-9]/g, '');
                  setAccountRaw(cleaned);
                  if (fieldErrors.accountRaw) {
                    setFieldErrors((prev) => ({ ...prev, accountRaw: '' }));
                  }
                }}
                aria-invalid={Boolean(fieldErrors.accountRaw)}
              />
              <small className="shop-bank-field-hint">
                Số tài khoản gửi bảo mật qua HTTPS và được mã hóa lưu trữ. Hệ thống không lưu số tài
                khoản thô.
              </small>
              {fieldErrors.accountRaw && (
                <p className="profile-field-error">{fieldErrors.accountRaw}</p>
              )}
            </div>

            <div className="shop-bank-form-actions">
              <Button type="submit" disabled={saveBankMutation.isPending}>
                {saveBankMutation.isPending
                  ? 'Đang lưu tài khoản…'
                  : 'Lưu tài khoản ngân hàng shop'}
              </Button>
              {isReady && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={saveBankMutation.isPending}
                  onClick={cancelEditing}
                >
                  Hủy
                </Button>
              )}
            </div>
          </form>
        </div>
      )}
    </>
  );

  if (variant === 'embedded') {
    return (
      <section
        id={sectionId}
        className="shop-bank-section embedded"
        aria-labelledby={`shop-bank-title-${sellerId}`}
      >
        {content}
      </section>
    );
  }

  return (
    <section
      id={sectionId}
      className="business-panel shop-bank-section"
      aria-labelledby={`shop-bank-title-${sellerId}`}
    >
      {content}
    </section>
  );
}

export default ShopBankSection;
