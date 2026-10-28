'use client';

import { useId, useState, type FormEvent, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, Search, RefreshCw, X, Users } from '@florabot/ui';
import { request, type Session } from '@/shared/lib/api';
import type { Profile, ProfileInput } from '../account-management.types';
import { accountStatuses, roleLabels, statusLabels } from '../account-management.constants';
import { message, dateText } from '../account-management.utils';
import '../styles/platform-management.css';

export {
  accountStatuses,
  roleLabels,
  statusLabels,
  message,
  dateText,
  type Profile,
  type ProfileInput,
};

export function Status({ value }: { value: string }) {
  return (
    <span className="management-status" data-status={value}>
      {statusLabels[value] ?? value}
    </span>
  );
}

export function DirectoryIdentity({
  name,
  secondary,
  kind = 'person',
}: {
  name: string;
  secondary?: string | null;
  kind?: 'person' | 'shop';
}) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((part) => part.slice(0, 1))
    .join('')
    .toLocaleUpperCase('vi-VN');
  return (
    <div className="platform-identity">
      <span
        className={`platform-identity-avatar ${kind === 'shop' ? 'is-shop' : ''}`}
        aria-hidden="true"
      >
        {initials || '–'}
      </span>
      <div>
        <strong>{name}</strong>
        {secondary && <span className="platform-identity-secondary">{secondary}</span>}
      </div>
    </div>
  );
}

export function DirectoryHeading({
  id,
  title,
  description,
  count,
  children,
}: {
  id: string;
  title: string;
  description: string;
  count?: number;
  children?: ReactNode;
}) {
  return (
    <div className="platform-directory-heading">
      <div>
        <h2 id={id}>{title}</h2>
        <p>{description}</p>
      </div>
      <div className="platform-directory-actions">
        {count !== undefined && (
          <span className="platform-result-count">
            <Users size={15} aria-hidden="true" />
            {count} mục trên trang
          </span>
        )}
        {children}
      </div>
    </div>
  );
}

export function useDirectory<T>(session: Session, endpoint: string, allowedRole: string) {
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [role, setRole] = useState('');
  const [page, setPage] = useState(1);
  const params = new URLSearchParams({ page: String(page), pageSize: '12' });
  if (search) params.set('search', search);
  if (status) params.set('status', status);
  if (role) params.set('role', role);
  const query = useQuery({
    queryKey: ['platform-directory', session.id, endpoint, search, status, role, page],
    queryFn: () => request<{ items: T[]; page: number; hasMore: boolean }>(`${endpoint}?${params}`),
    enabled: session.role === allowedRole,
  });
  return {
    draft,
    setDraft,
    search,
    setSearch,
    status,
    setStatus,
    role,
    setRole,
    page,
    setPage,
    query,
  };
}

export function DirectoryTools<T>({
  directory: d,
  statuses = accountStatuses,
  roles = false,
}: {
  directory: ReturnType<typeof useDirectory<T>>;
  statuses?: readonly string[];
  roles?: boolean;
}) {
  const id = useId();
  return (
    <form
      className="platform-tools"
      onSubmit={(event) => {
        event.preventDefault();
        d.setSearch(d.draft.trim());
        d.setPage(1);
      }}
    >
      <div className="platform-search-field">
        <label htmlFor={`${id}-search`}>Tìm kiếm</label>
        <div className="platform-search-input">
          <Search size={18} aria-hidden="true" />
          <input
            id={`${id}-search`}
            value={d.draft}
            maxLength={100}
            placeholder="Tên, email hoặc số điện thoại"
            onChange={(event) => d.setDraft(event.target.value)}
          />
        </div>
      </div>
      <div>
        <label htmlFor={`${id}-status`}>Trạng thái</label>
        <select
          id={`${id}-status`}
          value={d.status}
          onChange={(event) => {
            d.setStatus(event.target.value);
            d.setPage(1);
          }}
        >
          <option value="">Tất cả trạng thái</option>
          {statuses.map((value) => (
            <option key={value} value={value}>
              {statusLabels[value]}
            </option>
          ))}
        </select>
      </div>
      {roles && (
        <div>
          <label htmlFor={`${id}-role`}>Vai trò</label>
          <select
            id={`${id}-role`}
            value={d.role}
            onChange={(event) => {
              d.setRole(event.target.value);
              d.setPage(1);
            }}
          >
            <option value="">Tất cả vai trò</option>
            {Object.entries(roleLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="platform-filter-actions">
        <Button type="submit">Tìm kiếm</Button>
        <Button
          type="button"
          variant="outline"
          disabled={d.query.isFetching}
          onClick={() => void d.query.refetch()}
        >
          <RefreshCw size={16} aria-hidden="true" /> Tải lại
        </Button>
        {(d.search || d.draft || d.status || d.role) && (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              d.setDraft('');
              d.setSearch('');
              d.setStatus('');
              d.setRole('');
              d.setPage(1);
            }}
          >
            <X size={15} aria-hidden="true" />
            Xóa bộ lọc
          </Button>
        )}
      </div>
    </form>
  );
}

export function PageControls({
  page,
  hasMore,
  busy,
  onPage,
}: {
  page: number;
  hasMore: boolean;
  busy: boolean;
  onPage: (page: number) => void;
}) {
  return (
    <nav className="platform-pagination" aria-label="Phân trang danh sách">
      <Button variant="outline" disabled={busy || page <= 1} onClick={() => onPage(page - 1)}>
        Trang trước
      </Button>
      <span aria-live="polite">Trang {page}</span>
      <Button variant="outline" disabled={busy || !hasMore} onClick={() => onPage(page + 1)}>
        Trang sau
      </Button>
    </nav>
  );
}

export function LoadState({
  pending,
  error,
  retry,
  children,
}: {
  pending: boolean;
  error: unknown;
  retry: () => void;
  children: ReactNode;
}) {
  if (pending) return <p role="status">Đang tải dữ liệu…</p>;
  if (error)
    return (
      <div role="alert" className="platform-error">
        <p>{message(error)}</p>
        <Button variant="outline" onClick={retry}>
          Thử lại
        </Button>
      </div>
    );
  return <>{children}</>;
}

export function BasicProfileForm({
  initial,
  save,
  busy,
  nameLabel = 'Họ và tên',
  phoneRequired = false,
  cancel,
}: {
  initial: ProfileInput;
  save: (value: ProfileInput) => Promise<void>;
  busy: boolean;
  nameLabel?: string;
  phoneRequired?: boolean;
  cancel?: () => void;
}) {
  const id = useId();
  const [fullName, setFullName] = useState(initial.fullName);
  const [phone, setPhone] = useState(initial.phone ?? '');
  const [address, setAddress] = useState(initial.address ?? '');
  const [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError('');
    if (fullName.trim().length < 2) {
      setError(`${nameLabel} cần ít nhất 2 ký tự.`);
      return;
    }
    const hasControlCharacters = (value: string) =>
      Array.from(value).some(
        (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
      );
    if (hasControlCharacters(fullName)) {
      setError(`${nameLabel} không được chứa ký tự điều khiển.`);
      return;
    }
    if (address.trim().length > 300 || hasControlCharacters(address)) {
      setError('Địa chỉ tối đa 300 ký tự và không chứa ký tự xuống dòng hoặc điều khiển.');
      return;
    }
    if (
      (phoneRequired || phone.trim()) &&
      !/^(0[35789][0-9]{8}|\+84[35789][0-9]{8})$/.test(phone.trim())
    ) {
      setError('Số điện thoại Việt Nam không hợp lệ.');
      return;
    }
    try {
      await save({
        fullName: fullName.trim(),
        // BE treats null as unchanged; an empty string explicitly clears the field.
        phone: phone.trim(),
        address: address.trim(),
      });
    } catch (cause) {
      setError(message(cause));
    }
  }
  return (
    <form className="platform-form" onSubmit={(event) => void submit(event)}>
      <fieldset disabled={busy}>
        <legend>Thông tin liên hệ</legend>
        <div className="platform-form-grid">
          <div className="platform-field platform-field-wide">
            <label htmlFor={`${id}-name`}>{nameLabel}</label>
            <input
              id={`${id}-name`}
              required
              minLength={2}
              maxLength={120}
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
            />
          </div>
          <div className="platform-field platform-field-wide">
            <label htmlFor={`${id}-phone`}>Số điện thoại{phoneRequired ? ' (bắt buộc)' : ''}</label>
            <input
              id={`${id}-phone`}
              type="tel"
              required={phoneRequired}
              maxLength={20}
              aria-describedby={`${id}-phone-hint`}
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
            <small id={`${id}-phone-hint`} className="platform-field-hint">
              Số Việt Nam, ví dụ 0901234567 hoặc +84901234567.
            </small>
          </div>
          <div className="platform-field platform-field-wide">
            <div className="platform-field-label">
              <label htmlFor={`${id}-address`}>Địa chỉ</label>
              <small aria-hidden="true">{address.length}/300</small>
            </div>
            <textarea
              id={`${id}-address`}
              maxLength={300}
              value={address}
              onChange={(event) => setAddress(event.target.value)}
            />
          </div>
        </div>
      </fieldset>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div className="platform-actions platform-form-footer">
        <Button type="submit" disabled={busy}>
          {busy ? 'Đang lưu…' : 'Lưu thay đổi'}
        </Button>
        {cancel && (
          <Button type="button" variant="outline" disabled={busy} onClick={cancel}>
            Hủy chỉnh sửa
          </Button>
        )}
      </div>
    </form>
  );
}
