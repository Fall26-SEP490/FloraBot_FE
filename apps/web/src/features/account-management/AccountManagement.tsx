'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Button,
  CheckCircle2,
  CircleAlert,
  Eye,
  EyeOff,
  Lock,
  Plus,
  RefreshCw,
  Search,
  Users,
} from '@florabot/ui';
import { ApiError, queryClient, request, sessionQuery } from '@/shared/lib/api';
import { ConfirmDialog, Modal } from '../../shared/components/Modal';
import {
  DataTable,
  TablePagination,
  type DataTableColumn,
} from '../../shared/components/DataTable';
import { paginate } from '../../shared/pagination';
import AccountProfileDialog from './components/AccountProfileDialog';
import './styles/account-management.css';

export type AccountStatus = 'ACTIVE' | 'LOCKED' | 'DISABLED';
export type AccountRole = 'OPERATIONS_MANAGER' | 'TECHNICIAN' | 'SELLER_STAFF';

export interface AccountDirectoryItem {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  status: AccountStatus;
  role: string;
  createdAt: string;
}

export interface AccountManagementProps {
  actorRole: 'ADMIN' | 'OPERATIONS_MANAGER' | 'SELLER';
  targetRole: AccountRole;
  title: string;
  eyebrow: string;
  description: string;
  createLabel: string;
  itemName: string;
  apiBase: string;
  listEndpoint?: string;
  sellerId?: string | null;
}

const phonePattern = /^(0[35789][0-9]{8}|\+84[35789][0-9]{8})$/;
const emailPattern = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const createAccountSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, 'Họ và tên phải từ 2 đến 120 ký tự.')
    .max(120, 'Họ và tên tối đa 120 ký tự.'),
  email: z
    .string()
    .trim()
    .max(254, 'Email tối đa 254 ký tự.')
    .regex(emailPattern, 'Email không đúng định dạng.'),
  password: z
    .string()
    .min(6, 'Mật khẩu phải từ 6 đến 72 ký tự.')
    .refine((val) => new TextEncoder().encode(val).length <= 72, {
      message: 'Mật khẩu tối đa 72 byte UTF-8.',
    }),
  phone: z
    .string()
    .trim()
    .optional()
    .refine((val) => !val || phonePattern.test(val), {
      message: 'Số điện thoại Việt Nam không hợp lệ (ví dụ: 0901234567 hoặc +84901234567).',
    }),
});

type CreateAccountValues = z.infer<typeof createAccountSchema>;

const PAGE_SIZE = 6;

const statusText: Record<AccountStatus, string> = {
  ACTIVE: 'Đang hoạt động',
  LOCKED: 'Tạm khóa',
  DISABLED: 'Đã vô hiệu hóa',
};

const roleDisplayText: Record<string, string> = {
  SELLER_STAFF: 'Nhân viên shop',
  TECHNICIAN: 'Kỹ thuật viên',
  OPERATIONS_MANAGER: 'Quản lý vận hành',
};

function StatusBadge({ status }: { status: AccountStatus }) {
  return (
    <span className="management-status" data-status={status}>
      {statusText[status] ?? status}
    </span>
  );
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'NV';
  if (parts.length === 1) return parts[0].slice(0, 2).toLocaleUpperCase('vi-VN');
  return `${parts[0].slice(0, 1)}${parts[parts.length - 1].slice(0, 1)}`.toLocaleUpperCase('vi-VN');
}

export default function AccountManagement({
  actorRole,
  targetRole,
  title,
  eyebrow,
  description,
  createLabel,
  itemName,
  apiBase,
  listEndpoint,
  sellerId,
}: AccountManagementProps) {
  const actorSession = useQuery(sessionQuery);
  const [createOpen, setCreateOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [viewing, setViewing] = useState<AccountDirectoryItem | null>(null);
  const [statusConfirm, setStatusConfirm] = useState<{
    account: AccountDirectoryItem;
    targetStatus: AccountStatus;
  } | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | AccountStatus>('ALL');
  const [page, setPage] = useState(1);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const errorAlertRef = useRef<HTMLDivElement>(null);
  const createButtonRef = useRef<HTMLButtonElement>(null);

  // Guard against unauthorized roles or missing sellerId
  const isAuthorized =
    actorRole === 'ADMIN' ||
    actorRole === 'OPERATIONS_MANAGER' ||
    (actorRole === 'SELLER' && !!sellerId);

  const queryPath = listEndpoint ?? apiBase;
  const queryKey = useMemo(
    () => ['account-directory', targetRole, sellerId ?? 'platform', queryPath],
    [targetRole, sellerId, queryPath],
  );

  const {
    data: accounts = [],
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey,
    queryFn: () => request<AccountDirectoryItem[]>(queryPath),
    enabled: isAuthorized,
  });

  const form = useForm<CreateAccountValues>({
    resolver: zodResolver(createAccountSchema),
    mode: 'onSubmit',
    defaultValues: {
      fullName: '',
      email: '',
      password: '',
      phone: '',
    },
  });

  const createMutation = useMutation({
    mutationFn: (values: CreateAccountValues) => {
      const payload = {
        fullName: values.fullName.trim(),
        email: values.email.trim().toLowerCase(),
        password: values.password,
        phone: values.phone?.trim() || null,
      };
      return request<AccountDirectoryItem>(apiBase, payload);
    },
    onSuccess: (newAccount) => {
      form.reset();
      setShowPassword(false);
      setCreateOpen(false);
      setActionSuccess(`Đã tạo thành công tài khoản cho ${newAccount.fullName}.`);
      setActionError(null);
      void queryClient.invalidateQueries({ queryKey });
      void queryClient.invalidateQueries({ queryKey: ['staff-directory'] });
      createButtonRef.current?.focus();
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          setActionError('Email hoặc số điện thoại này đã được sử dụng trong hệ thống.');
        } else if (err.status === 401 || err.status === 403) {
          setActionError(
            'Bạn không có quyền thực hiện thao tác này hoặc phiên đăng nhập đã hết hạn.',
          );
        } else {
          setActionError(err.message);
        }
      } else {
        setActionError('Không kết nối được với máy chủ. Vui lòng kiểm tra kết nối mạng.');
      }
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: AccountStatus }) => {
      const endpoint = `${apiBase}/${id}/status`;
      return request<AccountDirectoryItem>(endpoint, { status }, true, 'PATCH');
    },
    onSuccess: (updated) => {
      setStatusConfirm(null);
      setActionSuccess(
        `Đã cập nhật trạng thái của ${updated.fullName} thành “${statusText[updated.status]}”.`,
      );
      setActionError(null);
      void queryClient.invalidateQueries({ queryKey });
      void queryClient.invalidateQueries({ queryKey: ['staff-directory'] });
    },
    onError: (err) => {
      setStatusConfirm(null);
      if (err instanceof ApiError) {
        if (err.status === 401 || err.status === 403) {
          setActionError('Bạn không có quyền cập nhật trạng thái này hoặc phiên đã hết hạn.');
        } else {
          setActionError(err.message);
        }
      } else {
        setActionError('Cập nhật trạng thái không thành công. Vui lòng thử lại.');
      }
    },
  });

  const closeCreate = useCallback(() => {
    if (createMutation.isPending) return;
    setCreateOpen(false);
    form.reset();
    setShowPassword(false);
  }, [createMutation.isPending, form]);
  const closeDetails = useCallback(() => setViewing(null), []);
  const closeStatus = useCallback(() => {
    if (!statusMutation.isPending) setStatusConfirm(null);
  }, [statusMutation.isPending]);

  useEffect(() => {
    if (actionError && !createOpen && errorAlertRef.current) {
      errorAlertRef.current.focus();
    }
  }, [actionError, createOpen]);

  if (!isAuthorized) {
    return (
      <section
        className="management-panel account-management-workspace"
        role="alert"
        aria-labelledby="unauthorized-management-title"
      >
        <div className="account-directory-card">
          <h2 id="unauthorized-management-title">Không có quyền truy cập</h2>
          <p>
            {actorRole === 'SELLER' && !sellerId
              ? 'Thiếu thông tin cửa hàng liên kết với phiên làm việc hiện tại.'
              : 'Vai trò hiện tại không được phép truy cập giao diện quản lý nhân sự.'}
          </p>
        </div>
      </section>
    );
  }

  // Client search and filter
  const filtered = accounts.filter((item) => {
    if (statusFilter !== 'ALL' && item.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const matchName = item.fullName.toLowerCase().includes(q);
      const matchEmail = item.email.toLowerCase().includes(q);
      const matchPhone = item.phone ? item.phone.toLowerCase().includes(q) : false;
      if (!matchName && !matchEmail && !matchPhone) return false;
    }
    return true;
  });

  const pagedRows = paginate(filtered, page, PAGE_SIZE);

  const activeCount = accounts.filter((a) => a.status === 'ACTIVE').length;
  const lockedCount = accounts.filter((a) => a.status === 'LOCKED').length;
  const disabledCount = accounts.filter((a) => a.status === 'DISABLED').length;

  const columns: readonly DataTableColumn<AccountDirectoryItem>[] = [
    {
      key: 'fullName',
      header: 'Họ và tên',
      render: (item) => (
        <div className="account-identity-cell">
          <span className="account-identity-avatar" aria-hidden="true">
            {getInitials(item.fullName)}
          </span>
          <div className="account-identity-meta">
            <strong>{item.fullName}</strong>
            <small>{roleDisplayText[item.role] || item.role}</small>
          </div>
        </div>
      ),
    },
    {
      key: 'email',
      header: 'Email',
      render: (item) => item.email,
    },
    {
      key: 'phone',
      header: 'Số điện thoại',
      render: (item) => item.phone || '—',
    },
    {
      key: 'status',
      header: 'Trạng thái',
      render: (item) => <StatusBadge status={item.status} />,
    },
    {
      key: 'createdAt',
      header: 'Ngày tạo',
      render: (item) =>
        new Date(item.createdAt).toLocaleDateString('vi-VN', {
          timeZone: 'Asia/Ho_Chi_Minh',
        }),
    },
    {
      key: 'actions',
      header: 'Thao tác',
      className: 'management-actions-cell',
      render: (item) => (
        <div className="management-row-actions">
          {actorRole === 'SELLER' && targetRole === 'SELLER_STAFF' && item.status === 'ACTIVE' && (
            <Link href={`/seller/staff-chats?staff=${encodeURIComponent(item.id)}`}>
              Nhắn tin<span className="sr-only"> {item.fullName}</span>
            </Link>
          )}
          <button type="button" onClick={() => setViewing(item)}>
            Chi tiết
            <span className="sr-only"> {item.fullName}</span>
          </button>
          {item.status === 'ACTIVE' && (
            <>
              <button
                type="button"
                onClick={() => setStatusConfirm({ account: item, targetStatus: 'LOCKED' })}
              >
                Khóa
                <span className="sr-only"> {item.fullName}</span>
              </button>
              <button
                type="button"
                className="management-row-danger"
                onClick={() => setStatusConfirm({ account: item, targetStatus: 'DISABLED' })}
              >
                Vô hiệu hóa
                <span className="sr-only"> {item.fullName}</span>
              </button>
            </>
          )}
          {item.status === 'LOCKED' && (
            <>
              <button
                type="button"
                onClick={() => setStatusConfirm({ account: item, targetStatus: 'ACTIVE' })}
              >
                Mở khóa
                <span className="sr-only"> {item.fullName}</span>
              </button>
              <button
                type="button"
                className="management-row-danger"
                onClick={() => setStatusConfirm({ account: item, targetStatus: 'DISABLED' })}
              >
                Vô hiệu hóa
                <span className="sr-only"> {item.fullName}</span>
              </button>
            </>
          )}
          {item.status === 'DISABLED' && (
            <button
              type="button"
              onClick={() => setStatusConfirm({ account: item, targetStatus: 'ACTIVE' })}
            >
              Khôi phục
              <span className="sr-only"> {item.fullName}</span>
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <section
      className="management-panel account-management-workspace"
      aria-labelledby="account-management-title"
    >
      {/* Summary stats strip at top */}
      <div
        role="region"
        className="management-stats order-summary-strip"
        aria-label={`Thống kê ${title.toLocaleLowerCase('vi-VN')}`}
      >
        <article className="operations-metric">
          <div className="account-stat-top">
            <span>Tổng số {itemName}</span>
            <div className="account-stat-icon">
              <Users size={18} aria-hidden="true" />
            </div>
          </div>
          <strong>{accounts.length}</strong>
          <small>Tài khoản trong danh sách</small>
        </article>
        <article className="operations-metric">
          <div className="account-stat-top">
            <span>Đang hoạt động</span>
            <div className="account-stat-icon account-stat-icon--green">
              <CheckCircle2 size={18} aria-hidden="true" />
            </div>
          </div>
          <strong>{activeCount}</strong>
          <small>Đang làm việc bình thường</small>
        </article>
        <article className="operations-metric">
          <div className="account-stat-top">
            <span>Tạm khóa / Vô hiệu</span>
            <div className="account-stat-icon account-stat-icon--amber">
              <Lock size={18} aria-hidden="true" />
            </div>
          </div>
          <strong>{lockedCount + disabledCount}</strong>
          <small>
            {lockedCount} tạm khóa · {disabledCount} vô hiệu hóa
          </small>
        </article>
      </div>

      <div className="account-directory-card">
        <div className="management-heading">
          <div>
            <p className="management-eyebrow">{eyebrow}</p>
            <h2 id="account-management-title">{title}</h2>
            <p>{description}</p>
          </div>
          <div className="management-heading-actions">
            <Button
              type="button"
              variant="outline"
              onClick={() => void refetch()}
              disabled={isFetching}
              aria-label="Tải lại danh sách"
            >
              <RefreshCw size={14} aria-hidden="true" className={isFetching ? 'spin' : ''} />
              {isFetching ? 'Đang tải…' : 'Làm mới'}
            </Button>
            <Button
              ref={createButtonRef}
              type="button"
              onClick={() => {
                form.reset();
                createMutation.reset();
                setShowPassword(false);
                setActionError(null);
                setCreateOpen(true);
              }}
            >
              <Plus size={15} aria-hidden="true" />
              {createLabel}
            </Button>
          </div>
        </div>

        {actionSuccess && (
          <div role="status" className="management-alert management-alert-success">
            {actionSuccess}
          </div>
        )}

        {actionError && (
          <div
            ref={errorAlertRef}
            tabIndex={-1}
            role="alert"
            className="management-alert management-alert-error"
          >
            {actionError}
          </div>
        )}

        {/* Quick Status Filter Tabs */}
        <div className="account-status-tabs" role="group" aria-label="Bộ lọc nhanh theo trạng thái">
          {(
            [
              { id: 'ALL', label: 'Tất cả', count: accounts.length },
              { id: 'ACTIVE', label: 'Đang hoạt động', count: activeCount },
              { id: 'LOCKED', label: 'Tạm khóa', count: lockedCount },
              { id: 'DISABLED', label: 'Đã vô hiệu hóa', count: disabledCount },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`account-status-tab ${statusFilter === tab.id ? 'is-active' : ''}`}
              onClick={() => {
                setStatusFilter(tab.id);
                setPage(1);
              }}
            >
              <span>{tab.label}</span>
              <span className="account-status-tab-count">{tab.count}</span>
            </button>
          ))}
        </div>

        {/* Search and Filter toolbar */}
        <div className="management-toolbar">
          <div className="management-search">
            <label htmlFor="account-search-input" className="sr-only">
              Tìm kiếm theo họ tên, email hoặc số điện thoại
            </label>
            <div className="management-search-wrapper">
              <Search size={15} aria-hidden="true" className="management-search-icon" />
              <input
                id="account-search-input"
                type="search"
                placeholder="Tìm theo họ tên, email, SĐT…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>
          <div>
            <label htmlFor="account-status-filter" className="sr-only">
              Lọc theo trạng thái
            </label>
            <select
              id="account-status-filter"
              className="management-filter-select"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as 'ALL' | AccountStatus);
                setPage(1);
              }}
            >
              <option value="ALL">Tất cả trạng thái ({accounts.length})</option>
              <option value="ACTIVE">Đang hoạt động ({activeCount})</option>
              <option value="LOCKED">Tạm khóa ({lockedCount})</option>
              <option value="DISABLED">Đã vô hiệu hóa ({disabledCount})</option>
            </select>
          </div>
        </div>

        {/* Loading & Error States */}
        {isLoading && (
          <div className="management-loading" role="status">
            <p>Đang tải danh sách {itemName}…</p>
          </div>
        )}

        {isError && (
          <div className="management-loading" role="alert">
            <CircleAlert
              size={28}
              style={{ color: 'var(--color-status-danger-ink)', margin: '0 auto 0.5rem' }}
            />
            <p>
              {error instanceof ApiError
                ? error.message
                : `Không tải được danh sách ${itemName}. Vui lòng kiểm tra lại.`}
            </p>
            <Button type="button" onClick={() => void refetch()}>
              Thử lại
            </Button>
          </div>
        )}

        {/* Data Table */}
        {!isLoading && !isError && (
          <>
            <DataTable
              caption={title}
              columns={columns}
              rows={pagedRows}
              getRowKey={(item) => item.id}
              emptyMessage={
                search || statusFilter !== 'ALL'
                  ? 'Không tìm thấy tài khoản nào khớp với bộ lọc.'
                  : `Chưa có ${itemName} nào được tạo trong hệ thống.`
              }
            />
            {filtered.length > PAGE_SIZE && (
              <TablePagination
                page={page}
                pageSize={PAGE_SIZE}
                totalItems={filtered.length}
                onPageChange={setPage}
              />
            )}
          </>
        )}
      </div>

      {/* Creation Modal */}
      <Modal
        open={createOpen}
        title={createLabel}
        description="Nhập thông tin để tạo tài khoản mới. Mật khẩu phải từ 6 đến 72 ký tự."
        onClose={closeCreate}
        closeDisabled={createMutation.isPending}
      >
        <form
          className="management-form account-create-form"
          onSubmit={form.handleSubmit((values) => {
            setActionError(null);
            createMutation.mutate(values);
          })}
          noValidate
        >
          {createMutation.isError && (
            <p role="alert" className="management-alert management-alert-error">
              {createMutation.error instanceof ApiError
                ? createMutation.error.message
                : 'Chưa tạo được tài khoản. Vui lòng kiểm tra lại.'}
            </p>
          )}

          <div className="account-form-grid">
            <div className="management-field">
              <label htmlFor="account-fullname">
                Họ và tên <span aria-hidden="true">*</span>
              </label>
              <input
                id="account-fullname"
                type="text"
                placeholder="Nguyễn Văn A"
                autoComplete="name"
                data-autofocus
                {...form.register('fullName')}
                aria-invalid={form.formState.errors.fullName ? 'true' : 'false'}
                aria-describedby={
                  form.formState.errors.fullName ? 'account-fullname-error' : undefined
                }
              />
              {form.formState.errors.fullName && (
                <p id="account-fullname-error" className="management-field-error" role="alert">
                  {form.formState.errors.fullName.message}
                </p>
              )}
            </div>

            <div className="management-field">
              <label htmlFor="account-phone">Số điện thoại (tùy chọn)</label>
              <input
                id="account-phone"
                type="tel"
                placeholder="0901234567"
                autoComplete="tel"
                inputMode="tel"
                {...form.register('phone')}
                aria-invalid={form.formState.errors.phone ? 'true' : 'false'}
                aria-describedby={form.formState.errors.phone ? 'account-phone-error' : undefined}
              />
              {form.formState.errors.phone && (
                <p id="account-phone-error" className="management-field-error" role="alert">
                  {form.formState.errors.phone.message}
                </p>
              )}
            </div>
          </div>

          <div className="account-form-grid">
            <div className="management-field">
              <label htmlFor="account-email">
                Địa chỉ email <span aria-hidden="true">*</span>
              </label>
              <input
                id="account-email"
                type="email"
                placeholder="ten@florabot.vn"
                autoComplete="email"
                inputMode="email"
                autoCapitalize="none"
                spellCheck={false}
                {...form.register('email')}
                aria-invalid={form.formState.errors.email ? 'true' : 'false'}
                aria-describedby={form.formState.errors.email ? 'account-email-error' : undefined}
              />
              {form.formState.errors.email && (
                <p id="account-email-error" className="management-field-error" role="alert">
                  {form.formState.errors.email.message}
                </p>
              )}
            </div>

            <div className="management-field">
              <label htmlFor="account-password">
                Mật khẩu <span aria-hidden="true">*</span>
              </label>
              <div className="management-password-wrap">
                <input
                  id="account-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Tối thiểu 6 ký tự"
                  {...form.register('password')}
                  aria-invalid={form.formState.errors.password ? 'true' : 'false'}
                  aria-describedby={
                    form.formState.errors.password ? 'account-password-error' : undefined
                  }
                />
                <button
                  type="button"
                  className="management-password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  aria-pressed={showPassword}
                >
                  {showPassword ? (
                    <EyeOff size={16} aria-hidden="true" />
                  ) : (
                    <Eye size={16} aria-hidden="true" />
                  )}
                </button>
              </div>
              {form.formState.errors.password && (
                <p id="account-password-error" className="management-field-error" role="alert">
                  {form.formState.errors.password.message}
                </p>
              )}
            </div>
          </div>

          <div className="management-modal-actions">
            <Button
              type="button"
              variant="outline"
              disabled={createMutation.isPending}
              onClick={() => {
                setCreateOpen(false);
                form.reset();
                setShowPassword(false);
              }}
            >
              Hủy
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Đang tạo…' : 'Tạo tài khoản'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Details Modal */}
      {viewing && targetRole !== 'SELLER_STAFF' && (
        <AccountProfileDialog
          key={viewing.id}
          actorId={actorSession.data?.id ?? actorRole}
          endpoint={`${apiBase}/${viewing.id}`}
          title={`Chi tiết ${itemName}`}
          close={closeDetails}
        />
      )}
      <Modal
        open={viewing !== null && targetRole === 'SELLER_STAFF'}
        title={`Chi tiết ${itemName}`}
        description="Thông tin tài khoản trên hệ thống FloraBot."
        onClose={closeDetails}
      >
        {viewing && (
          <div className="account-detail-view">
            <div className="account-detail-hero">
              <div className="account-detail-hero-id">
                <span className="account-detail-hero-avatar" aria-hidden="true">
                  {getInitials(viewing.fullName)}
                </span>
                <div className="account-detail-hero-text">
                  <strong>{viewing.fullName}</strong>
                  <span>{viewing.email}</span>
                </div>
              </div>
              <StatusBadge status={viewing.status} />
            </div>
            <dl className="management-details">
              <div>
                <dt>Họ và tên</dt>
                <dd>{viewing.fullName}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{viewing.email}</dd>
              </div>
              <div>
                <dt>Số điện thoại</dt>
                <dd>{viewing.phone || 'Chưa cập nhật'}</dd>
              </div>
              <div>
                <dt>Trạng thái</dt>
                <dd>
                  <StatusBadge status={viewing.status} />
                </dd>
              </div>
              <div>
                <dt>Vai trò</dt>
                <dd>{roleDisplayText[viewing.role] || viewing.role}</dd>
              </div>
              <div>
                <dt>Ngày khởi tạo</dt>
                <dd>
                  {new Date(viewing.createdAt).toLocaleString('vi-VN', {
                    timeZone: 'Asia/Ho_Chi_Minh',
                  })}
                </dd>
              </div>
            </dl>
            <div className="management-modal-actions">
              <Button type="button" onClick={() => setViewing(null)} data-autofocus>
                Đóng
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Status Confirm Dialog */}
      {statusConfirm && (
        <ConfirmDialog
          open={statusConfirm !== null}
          title={
            statusConfirm.targetStatus === 'LOCKED'
              ? `Khóa tài khoản ${statusConfirm.account.fullName}?`
              : statusConfirm.targetStatus === 'DISABLED'
                ? `Vô hiệu hóa tài khoản ${statusConfirm.account.fullName}?`
                : `Kích hoạt lại tài khoản ${statusConfirm.account.fullName}?`
          }
          description={
            statusConfirm.targetStatus === 'LOCKED'
              ? `${statusConfirm.account.fullName} sẽ bị tạm khóa và không thể đăng nhập hoặc thực hiện công việc cho đến khi được mở khóa lại.`
              : statusConfirm.targetStatus === 'DISABLED'
                ? `${statusConfirm.account.fullName} sẽ bị vô hiệu hóa hoàn toàn quyền truy cập trong hệ thống.`
                : `${statusConfirm.account.fullName} sẽ được chuyển lại trạng thái Đang hoạt động và có thể đăng nhập bình thường.`
          }
          confirmLabel={
            statusConfirm.targetStatus === 'LOCKED'
              ? 'Xác nhận khóa'
              : statusConfirm.targetStatus === 'DISABLED'
                ? 'Xác nhận vô hiệu hóa'
                : 'Xác nhận kích hoạt'
          }
          onConfirm={() => {
            if (statusMutation.isPending) return;
            statusMutation.mutate({
              id: statusConfirm.account.id,
              status: statusConfirm.targetStatus,
            });
          }}
          onCancel={closeStatus}
          pending={statusMutation.isPending}
        />
      )}
    </section>
  );
}
