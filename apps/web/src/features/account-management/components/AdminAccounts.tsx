'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@florabot/ui';
import { request, type Session } from '@/shared/lib/api';
import { Modal } from '../../../shared/components/Modal';
import { DataTable } from '../../../shared/components/DataTable';
import type {
  AdminAccountSummary as Summary,
  AdminAccountProfileResponse as Detail,
} from '../account-management.types';
import {
  DirectoryTools,
  DirectoryHeading,
  DirectoryIdentity,
  LoadState,
  PageControls,
  Status,
  dateText,
  message,
  roleLabels,
  useDirectory,
} from './management';

function SensitiveProfile({
  id,
  actorId,
  close,
}: {
  id: string;
  actorId: string;
  close: () => void;
}) {
  const [profile, setProfile] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  const [showBank, setShowBank] = useState(false);
  const closeRef = useRef(close);
  function reload() {
    setProfile(null);
    setShowBank(false);
    setError('');
    setLoading(true);
    setVersion((value) => value + 1);
  }
  useEffect(() => {
    closeRef.current = close;
  }, [close]);
  useEffect(() => {
    let active = true;
    // Full banking details stay in this mounted dialog, never in the query cache.
    void request<Detail>(`/admin/accounts/${id}/profile`)
      .then((value) => {
        if (active && !document.hidden) setProfile(value);
      })
      .catch((cause) => {
        if (active) setError(message(cause));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    const hide = () => {
      if (document.hidden) {
        active = false;
        setProfile(null);
        setShowBank(false);
        closeRef.current();
      }
    };
    document.addEventListener('visibilitychange', hide);
    const timer = window.setTimeout(() => {
      active = false;
      setProfile(null);
      setShowBank(false);
      setLoading(false);
    }, 60_000);
    return () => {
      active = false;
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', hide);
    };
  }, [id, actorId, version]);
  return (
    <Modal open title="Hồ sơ tài khoản hệ thống" onClose={close}>
      <div className="platform-management">
        <LoadState pending={loading} error={error || null} retry={reload}>
          {!profile && !error && (
            <div role="status">
              <p>Thông tin chi tiết đã được ẩn sau một phút.</p>
              <Button onClick={reload}>Đọc lại hồ sơ</Button>
            </div>
          )}
          {profile && (
            <>
              <div className="platform-profile-hero">
                <DirectoryIdentity
                  name={profile.fullName}
                  secondary={roleLabels[profile.role] ?? profile.role}
                />
                <Status value={profile.status} />
              </div>
              <dl className="management-details">
                <div>
                  <dt>Email đăng nhập</dt>
                  <dd>{profile.loginEmail || 'Chưa cập nhật'}</dd>
                </div>
                <div>
                  <dt>Email liên hệ</dt>
                  <dd>{profile.contactEmail || 'Chưa cập nhật'}</dd>
                </div>
                <div>
                  <dt>Điện thoại</dt>
                  <dd>{profile.phone || 'Chưa cập nhật'}</dd>
                </div>
                <div>
                  <dt>Địa chỉ</dt>
                  <dd>{profile.address || 'Chưa cập nhật'}</dd>
                </div>
                <div>
                  <dt>Giới tính</dt>
                  <dd>
                    {(
                      {
                        MALE: 'Nam',
                        FEMALE: 'Nữ',
                        OTHER: 'Khác',
                        UNDISCLOSED: 'Không công bố',
                      } as Record<string, string>
                    )[profile.gender ?? ''] ?? 'Chưa cập nhật'}
                  </dd>
                </div>
                <div>
                  <dt>Ngày sinh</dt>
                  <dd>{profile.dateOfBirth || 'Chưa cập nhật'}</dd>
                </div>
                <div>
                  <dt>Cập nhật</dt>
                  <dd>{dateText(profile.updatedAt)}</dd>
                </div>
              </dl>
              <div className="platform-bank-heading">
                <h3>Thông tin ngân hàng</h3>
                <Button variant="outline" onClick={() => setShowBank((value) => !value)}>
                  {showBank ? 'Ẩn số tài khoản' : 'Hiện số tài khoản'}
                </Button>
              </div>
              <section className="platform-card" aria-label="Ngân hàng cá nhân">
                <h3>Ngân hàng cá nhân</h3>
                {profile.personalBank ? (
                  <>
                    <p>
                      {profile.personalBank.bankName} · {profile.personalBank.accountHolder}
                    </p>
                    <p>
                      {showBank
                        ? profile.personalBank.accountNumber || 'Chưa đọc được số tài khoản'
                        : `••••${profile.personalBank.accountLast4}`}
                    </p>
                    {profile.personalBank.status === 'NEEDS_UPDATE' && (
                      <p>Thông tin ngân hàng cần được chủ tài khoản cập nhật lại.</p>
                    )}
                  </>
                ) : (
                  <p>Chưa có ngân hàng cá nhân.</p>
                )}
              </section>
              {profile.role === 'SELLER' && (
                <section className="platform-card" aria-label="Ngân hàng nhận tiền của shop">
                  <h3>Ngân hàng nhận tiền của shop</h3>
                  {profile.shopBank ? (
                    <>
                      <p>
                        {profile.shopBank.bankName} · {profile.shopBank.bankHolder}
                      </p>
                      <p>
                        {showBank
                          ? profile.shopBank.accountNumber || 'Chưa đọc được số tài khoản'
                          : `••••${profile.shopBank.accountSuffix ?? ''}`}
                      </p>
                      {profile.shopBank.status === 'NEEDS_UPDATE' && (
                        <p>Thông tin ngân hàng shop cần được cập nhật lại.</p>
                      )}
                    </>
                  ) : (
                    <p>Chưa có ngân hàng shop.</p>
                  )}
                </section>
              )}
            </>
          )}
        </LoadState>
      </div>
    </Modal>
  );
}

export default function AdminAccounts({ session }: { session: Session }) {
  const d = useDirectory<Summary>(session, '/admin/accounts', 'ADMIN');
  const [selected, setSelected] = useState<string | null>(null);
  if (session.role !== 'ADMIN') return <p role="alert">Hồ sơ toàn hệ thống dành cho Admin.</p>;
  return (
    <section className="platform-management" aria-labelledby="admin-accounts-title">
      <DirectoryHeading
        id="admin-accounts-title"
        title="Danh bạ tài khoản"
        description="Tra cứu theo vai trò, trạng thái và thông tin liên hệ."
        count={d.query.data?.items.length}
      />
      <DirectoryTools directory={d} roles />
      <LoadState
        pending={d.query.isPending}
        error={d.query.error}
        retry={() => void d.query.refetch()}
      >
        <DataTable
          caption="Tài khoản hệ thống"
          rows={d.query.data?.items ?? []}
          getRowKey={(row) => row.id}
          emptyMessage="Chưa có tài khoản phù hợp với bộ lọc."
          columns={[
            {
              key: 'name',
              header: 'Tài khoản',
              render: (row) => (
                <DirectoryIdentity name={row.fullName} secondary={row.email || 'Chưa có email'} />
              ),
            },
            { key: 'role', header: 'Vai trò', render: (row) => roleLabels[row.role] ?? row.role },
            { key: 'status', header: 'Trạng thái', render: (row) => <Status value={row.status} /> },
            {
              key: 'bank',
              header: 'Ngân hàng cá nhân',
              render: (row) =>
                row.bank
                  ? `${row.bank.bankName || 'Ngân hàng'} · ••••${row.bank.accountLast4 || ''}`
                  : 'Chưa có',
            },
            {
              key: 'actions',
              header: 'Thao tác',
              render: (row) => (
                <Button variant="outline" onClick={() => setSelected(row.id)}>
                  Hồ sơ<span className="sr-only"> {row.fullName}</span>
                </Button>
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
      {selected && (
        <SensitiveProfile
          key={`${session.id}:${selected}`}
          id={selected}
          actorId={session.id}
          close={() => setSelected(null)}
        />
      )}
    </section>
  );
}
