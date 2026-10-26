'use client';

import { useId, useState, type FormEvent } from 'react';
import { Button } from '@florabot/ui';
import { ApiError, queryClient, request, type Session } from '../api';
import { DataTable } from '../dashboard/DataTable';
import { ConfirmDialog, Modal } from '../dashboard/Modal';
import type { components } from '../../../../packages/contracts/src/generated/api';
import AccountProfileDialog from './AccountProfileDialog';
import {
  DirectoryTools,
  DirectoryHeading,
  DirectoryIdentity,
  LoadState,
  PageControls,
  Status,
  accountStatuses,
  message,
  statusLabels,
  useDirectory,
  type Profile,
} from './management';

function CreateCustomer({ close, created }: { close: () => void; created: () => void }) {
  const id = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [uncertain, setUncertain] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || uncertain) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    const password = String(fields.get('password') ?? '');
    if (new TextEncoder().encode(password).length > 72) {
      setError('Mật khẩu tối đa 72 byte UTF-8.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await request('/operations/customers', {
        email: String(fields.get('email')).trim().toLowerCase(),
        fullName: String(fields.get('fullName')).trim(),
        password,
        phone: String(fields.get('phone') ?? '').trim() || null,
      } satisfies components['schemas']['CreateAccountRequest']);
      form.reset();
      created();
    } catch (cause) {
      setError(message(cause));
      if (!(cause instanceof ApiError) || cause.status >= 500) setUncertain(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal open title="Thêm khách hàng" onClose={close} closeDisabled={busy}>
      <form className="platform-management platform-form" onSubmit={(event) => void submit(event)}>
        <fieldset disabled={busy || uncertain}>
          <legend>Tài khoản khách hàng</legend>
          <div className="platform-form-grid">
            <div className="platform-field platform-field-wide">
              <label htmlFor={`${id}-name`}>Họ và tên</label>
              <input id={`${id}-name`} name="fullName" required minLength={2} maxLength={120} />
            </div>
            <div className="platform-field platform-field-wide">
              <label htmlFor={`${id}-email`}>Email đăng nhập</label>
              <input
                id={`${id}-email`}
                name="email"
                type="email"
                required
                maxLength={254}
                autoComplete="off"
              />
            </div>
            <div className="platform-field platform-field-wide">
              <label htmlFor={`${id}-password`}>Mật khẩu ban đầu</label>
              <input
                id={`${id}-password`}
                name="password"
                type="password"
                required
                minLength={6}
                maxLength={72}
                autoComplete="new-password"
              />
              <small className="platform-field-hint">
                Từ 6 ký tự, tối đa 72 byte. Khách dùng mật khẩu này để đăng nhập lần đầu.
              </small>
            </div>
            <div className="platform-field platform-field-wide">
              <label htmlFor={`${id}-phone`}>Số điện thoại (tùy chọn)</label>
              <input
                id={`${id}-phone`}
                name="phone"
                type="tel"
                pattern="(0[35789][0-9]{8}|\+84[35789][0-9]{8})"
                maxLength={12}
              />
            </div>
          </div>
        </fieldset>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {uncertain && (
          <p role="status">
            Chưa xác định tài khoản đã được tạo hay chưa. Đóng form và tìm theo email trong danh
            sách trước khi tạo lại.
          </p>
        )}
        <div className="platform-actions platform-form-footer">
          <Button type="submit" disabled={busy || uncertain}>
            {busy ? 'Đang tạo…' : 'Tạo khách hàng'}
          </Button>
          <Button type="button" variant="outline" disabled={busy} onClick={close}>
            Hủy
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default function ManagedCustomers({ session }: { session: Session }) {
  const d = useDirectory<Profile>(session, '/operations/customers', 'OPERATIONS_MANAGER');
  const [create, setCreate] = useState(false);
  const [selected, setSelected] = useState<Profile | null>(null);
  const [change, setChange] = useState<{ account: Profile; status: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  async function confirm() {
    if (!change || busy) return;
    setBusy(true);
    setError('');
    try {
      await request(
        `/operations/customers/${change.account.id}/status`,
        { status: change.status },
        true,
        'PATCH',
      );
      setNotice(`Đã đổi trạng thái ${change.account.fullName}: ${statusLabels[change.status]}.`);
      setChange(null);
      await queryClient.invalidateQueries({ queryKey: ['platform-directory'] });
    } catch (cause) {
      setError(message(cause));
    } finally {
      setBusy(false);
    }
  }
  if (session.role !== 'OPERATIONS_MANAGER')
    return <p role="alert">Khu vực này dành cho Quản lý vận hành.</p>;
  return (
    <section className="platform-management" aria-labelledby="managed-customers-title">
      <DirectoryHeading
        id="managed-customers-title"
        title="Danh sách khách hàng"
        description="Thông tin liên hệ và quyền truy cập của khách hàng."
        count={d.query.data?.items.length}
      >
        <Button onClick={() => setCreate(true)}>
          <span aria-hidden="true">+</span> Thêm khách hàng
        </Button>
      </DirectoryHeading>
      <DirectoryTools directory={d} />
      {notice && <p role="status">{notice}</p>}
      <LoadState
        pending={d.query.isPending}
        error={d.query.error}
        retry={() => void d.query.refetch()}
      >
        <DataTable
          caption="Khách hàng"
          rows={d.query.data?.items ?? []}
          getRowKey={(row) => row.id}
          emptyMessage="Chưa có khách hàng phù hợp với bộ lọc."
          columns={[
            {
              key: 'name',
              header: 'Khách hàng',
              render: (row) => (
                <DirectoryIdentity name={row.fullName} secondary={row.email || 'Chưa có email'} />
              ),
            },
            { key: 'phone', header: 'Điện thoại', render: (row) => row.phone || 'Chưa cập nhật' },
            { key: 'status', header: 'Trạng thái', render: (row) => <Status value={row.status} /> },
            {
              key: 'actions',
              header: 'Thao tác',
              render: (row) => (
                <div className="platform-actions">
                  <Button variant="outline" onClick={() => setSelected(row)}>
                    Chi tiết<span className="sr-only"> {row.fullName}</span>
                  </Button>
                  {accountStatuses
                    .filter((status) => status !== row.status)
                    .map((status) => (
                      <Button
                        key={status}
                        variant="outline"
                        disabled={busy}
                        onClick={() => {
                          setError('');
                          setChange({ account: row, status });
                        }}
                      >
                        {status === 'ACTIVE'
                          ? 'Khôi phục'
                          : status === 'LOCKED'
                            ? 'Khóa'
                            : 'Vô hiệu hóa'}
                        <span className="sr-only"> {row.fullName}</span>
                      </Button>
                    ))}
                </div>
              ),
            },
          ]}
        />
        <PageControls
          page={d.page}
          hasMore={d.query.data?.hasMore ?? false}
          busy={d.query.isFetching}
          onPage={d.setPage}
        />
      </LoadState>
      {create && (
        <CreateCustomer
          close={() => setCreate(false)}
          created={() => {
            setCreate(false);
            setNotice('Đã tạo tài khoản khách hàng.');
            d.setSearch('');
            d.setDraft('');
            d.setStatus('');
            d.setPage(1);
            void queryClient.invalidateQueries({ queryKey: ['platform-directory'] });
          }}
        />
      )}
      {selected && (
        <AccountProfileDialog
          key={selected.id}
          actorId={session.id}
          endpoint={`/operations/customers/${selected.id}`}
          title="Chi tiết khách hàng"
          close={() => setSelected(null)}
        />
      )}
      {change && (
        <ConfirmDialog
          open
          title={`${statusLabels[change.status]} tài khoản?`}
          description={`${change.account.fullName}. Khi tài khoản bị khóa hoặc vô hiệu hóa, phiên truy cập sẽ bị từ chối.${error ? ` ${error}` : ''}`}
          confirmLabel="Xác nhận trạng thái"
          pending={busy}
          onCancel={() => {
            if (!busy) setChange(null);
          }}
          onConfirm={() => void confirm()}
        />
      )}
    </section>
  );
}
