'use client';

import '../styles/operations-detail-polish.css';
import WorkspaceTable from '@/features/portal/components/WorkspaceTable';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@florabot/ui';
import { queryClient, request, type Session } from '@/shared/lib/api';
import DataTable from './DirectoryTable';
import { Modal } from '../../../shared/components/Modal';
import type { components } from '../../../../../../packages/contracts/src/generated/api';
import type {
  OperationsSellerSummary as Seller,
  OperationsSellerDetail as Detail,
  SellerAccountResponse as Owner,
  SellerStatusHistoryResponse as History,
} from '../account-management.types';
import {
  BasicProfileForm,
  DirectoryTools,
  DirectoryHeading,
  DirectoryIdentity,
  LoadState,
  PageControls,
  Status,
  dateText,
  message,
  useDirectory,
  type ProfileInput,
} from './management';

function shopPackageName(value: string | null | undefined) {
  return value && /^Kiosk pricing [0-9a-f-]{36}$/i.test(value)
    ? 'Giá thuê theo kiosk'
    : value || 'Chưa có gói';
}

const shopStatuses = ['PENDING', 'APPROVED', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CLOSED'];

function SellerDetail({ id, actorId, close }: { id: string; actorId: string; close: () => void }) {
  const [editShop, setEditShop] = useState(false);
  const [owner, setOwner] = useState<Owner | null>(null);
  const [historyPage, setHistoryPage] = useState(1);
  const [reason, setReason] = useState('');
  const [review, setReview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const base = `/operations/sellers/${id}`;
  const detail = useQuery({
    queryKey: ['platform-seller', actorId, id, 'detail'],
    queryFn: () => request<Detail>(base),
    staleTime: 0,
  });
  const owners = useQuery({
    queryKey: ['platform-seller', actorId, id, 'owners'],
    queryFn: () => request<Owner[]>(`${base}/accounts`),
  });
  const history = useQuery({
    queryKey: ['platform-seller', actorId, id, 'history', historyPage],
    queryFn: () => request<History>(`${base}/status-history?page=${historyPage}&pageSize=10`),
  });
  async function reload() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['platform-seller', actorId, id] }),
      queryClient.invalidateQueries({ queryKey: ['platform-directory'] }),
    ]);
  }
  async function saveShop(value: ProfileInput) {
    setBusy(true);
    try {
      await request(
        base,
        {
          shopName: value.fullName,
          phone: value.phone ?? '',
          address: value.address,
        } satisfies components['schemas']['UpdateSellerShopRequest'],
        true,
        'PUT',
      );
      await reload();
      setEditShop(false);
      setNotice('Đã lưu thông tin shop.');
    } finally {
      setBusy(false);
    }
  }
  async function saveOwner(value: ProfileInput) {
    if (!owner) return;
    setBusy(true);
    try {
      await request(`${base}/accounts/${owner.id}`, value, true, 'PUT');
      await reload();
      setOwner(null);
      setNotice('Đã lưu thông tin chủ shop.');
    } finally {
      setBusy(false);
    }
  }
  async function changeStatus() {
    if (
      !detail.data ||
      busy ||
      !review ||
      reason.trim().length < 5 ||
      !['ACTIVE', 'SUSPENDED'].includes(detail.data.status)
    )
      return;
    setBusy(true);
    setError('');
    try {
      await request(
        `${base}/status`,
        {
          status: detail.data.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE',
          reason: reason.trim(),
        } satisfies components['schemas']['UpdateSellerStatusRequest'],
        true,
        'PATCH',
      );
      setHistoryPage(1);
      await reload();
      setReason('');
      setReview(false);
      setNotice('Đã cập nhật trạng thái shop và lịch sử.');
    } catch (cause) {
      setError(message(cause));
      setReview(false);
      await reload();
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      open
      title="Chi tiết shop hoa"
      onClose={close}
      closeDisabled={busy}
      size="md"
      className="operations-shop-dialog"
    >
      <div className="platform-management platform-shop-detail">
        {notice && <p role="status">{notice}</p>}
        <div className="platform-shop-layout">
          <section className="platform-shop-main" aria-label="Thông tin shop">
            <LoadState
              pending={detail.isPending}
              error={detail.error}
              retry={() => void detail.refetch()}
            >
              {detail.data && (
                <>
                  <div className="platform-profile-hero">
                    <DirectoryIdentity name={detail.data.shopName} secondary="" kind="shop" />
                    <Status value={detail.data.status} />
                  </div>
                  <dl className="management-details">
                    <div>
                      <dt>Điện thoại</dt>
                      <dd>{detail.data.phone}</dd>
                    </div>
                    <div>
                      <dt>Địa chỉ shop</dt>
                      <dd>{detail.data.address || 'Chưa cập nhật'}</dd>
                    </div>
                    <div>
                      <dt>Email liên hệ</dt>
                      <dd>{detail.data.contactEmail || 'Chưa cập nhật'}</dd>
                    </div>
                    <div>
                      <dt>Gói hiện tại</dt>
                      <dd>{shopPackageName(detail.data.packageName)}</dd>
                    </div>
                    <div>
                      <dt>Hạn gói</dt>
                      <dd>
                        {dateText(detail.data.packageExpiresAtTs ?? detail.data.packageExpiresAt)}
                      </dd>
                    </div>
                  </dl>
                  {!editShop ? (
                    <Button variant="outline" disabled={busy} onClick={() => setEditShop(true)}>
                      Sửa thông tin shop
                    </Button>
                  ) : (
                    <BasicProfileForm
                      key={detail.data.updatedAt}
                      initial={{
                        fullName: detail.data.shopName,
                        phone: detail.data.phone,
                        address: detail.data.address,
                      }}
                      nameLabel="Tên shop"
                      phoneRequired
                      busy={busy}
                      save={saveShop}
                      cancel={() => setEditShop(false)}
                    />
                  )}
                  {['ACTIVE', 'SUSPENDED'].includes(detail.data.status) && (
                    <details className="operations-shop-status">
                      <summary>
                        {detail.data.status === 'ACTIVE' ? 'Tạm ngừng shop' : 'Khôi phục hoạt động'}
                      </summary>
                      <section aria-label="Khóa hoặc mở shop">
                        <label htmlFor="shop-status-reason">Lý do</label>
                        <textarea
                          id="shop-status-reason"
                          placeholder="Nhập lý do (tối thiểu 5 ký tự)"
                          value={reason}
                          minLength={5}
                          maxLength={1000}
                          disabled={busy || review}
                          onChange={(event) => setReason(event.target.value)}
                        />
                        {review ? (
                          <div className="platform-card">
                            <p>
                              Xác nhận {detail.data.status === 'ACTIVE' ? 'tạm ngừng' : 'khôi phục'}{' '}
                              shop {detail.data.shopName} với lý do: {reason.trim()}
                            </p>
                            <div className="platform-actions">
                              <Button disabled={busy} onClick={() => void changeStatus()}>
                                {busy ? 'Đang cập nhật…' : 'Xác nhận thay đổi shop'}
                              </Button>
                              <Button
                                variant="outline"
                                disabled={busy}
                                onClick={() => setReview(false)}
                              >
                                Quay lại
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <Button
                            disabled={busy || reason.trim().length < 5}
                            onClick={() => {
                              setReview(true);
                              setError('');
                            }}
                          >
                            Tiếp tục
                          </Button>
                        )}
                        {error && (
                          <p role="alert" className="error">
                            {error}
                          </p>
                        )}
                      </section>
                    </details>
                  )}
                </>
              )}
            </LoadState>
          </section>
          <div className="platform-shop-side">
            <details className="operations-shop-disclosure">
              <summary>Chủ shop</summary>
              <section aria-labelledby="seller-owner-title">
                <h3 id="seller-owner-title" className="sr-only">
                  Tài khoản chủ shop
                </h3>
                <LoadState
                  pending={owners.isPending}
                  error={owners.error}
                  retry={() => void owners.refetch()}
                >
                  {!owners.data?.length && <p>Chưa có tài khoản chủ shop.</p>}
                  {owners.data?.map((item) => (
                    <div key={item.id} className="platform-card">
                      <DirectoryIdentity name={item.fullName} secondary={item.email} />
                      <Status value={item.status} />
                      {item.phone && <p>{item.phone}</p>}
                      {item.address && <p>{item.address}</p>}
                      <Button variant="outline" disabled={busy} onClick={() => setOwner(item)}>
                        Sửa chủ shop<span className="sr-only"> {item.fullName}</span>
                      </Button>
                    </div>
                  ))}
                  {owner && (
                    <BasicProfileForm
                      key={owner.id}
                      initial={owner}
                      busy={busy}
                      save={saveOwner}
                      cancel={() => setOwner(null)}
                    />
                  )}
                </LoadState>
              </section>
            </details>
            <details className="operations-shop-disclosure">
              <summary>Lịch sử trạng thái</summary>
              <section aria-labelledby="seller-history-title">
                <h3 id="seller-history-title" className="sr-only">
                  Lịch sử trạng thái shop
                </h3>
                <LoadState
                  pending={history.isPending}
                  error={history.error}
                  retry={() => void history.refetch()}
                >
                  {!history.data?.items.length && <p>Chưa có thay đổi trạng thái trong lịch sử.</p>}
                  {!!history.data?.items.length && (
                    <WorkspaceTable label="Lịch sử trạng thái shop">
                      <table>
                        <thead>
                          <tr>
                            <th scope="col">Thời gian</th>
                            <th scope="col">Trạng thái</th>
                            <th scope="col">Lý do</th>
                            <th scope="col">Người thực hiện</th>
                          </tr>
                        </thead>
                        <tbody>
                          {history.data.items.map((item) => (
                            <tr key={item.id}>
                              <td>{dateText(item.createdAt)}</td>
                              <td>
                                {item.fromStatus || '—'} → {item.toStatus || '—'}
                              </td>
                              <td>{item.reason || '—'}</td>
                              <td>{item.actorId || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </WorkspaceTable>
                  )}
                  {(historyPage > 1 || history.data?.hasMore) && (
                    <PageControls
                      page={historyPage}
                      hasMore={history.data?.hasMore ?? false}
                      busy={history.isFetching}
                      onPage={setHistoryPage}
                    />
                  )}
                </LoadState>
              </section>
            </details>
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default function OperationsSellers({ session }: { session: Session }) {
  const [selected, setSelected] = useState<string | null>(null);
  const d = useDirectory<Seller>(session, '/operations/sellers', 'OPERATIONS_MANAGER', !selected);
  if (session.role !== 'OPERATIONS_MANAGER')
    return <p role="alert">Khu vực này dành cho Quản lý vận hành.</p>;
  return (
    <section
      className="platform-management operations-directory-page operations-shops-page"
      aria-labelledby="operations-sellers-title"
    >
      <DirectoryHeading
        id="operations-sellers-title"
        title="Danh sách shop hoa"
        count={d.query.data?.items.length}
      />
      <DirectoryTools directory={d} statuses={shopStatuses} />
      <LoadState
        pending={d.query.isPending}
        error={d.query.error}
        retry={() => void d.query.refetch()}
      >
        <DataTable
          caption="Shop hoa"
          rows={d.query.data?.items ?? []}
          getRowKey={(row) => row.id}
          emptyMessage="Chưa có shop phù hợp với bộ lọc."
          columns={[
            {
              key: 'shop',
              header: 'Shop',
              render: (row) => (
                <DirectoryIdentity name={row.shopName} secondary={row.phone} kind="shop" />
              ),
            },
            { key: 'status', header: 'Trạng thái', render: (row) => <Status value={row.status} /> },
            {
              key: 'package',
              header: 'Gói thuê',
              render: (row) => shopPackageName(row.packageName),
            },
            {
              key: 'actions',
              header: 'Thao tác',
              render: (row) => (
                <Button variant="outline" onClick={() => setSelected(row.id)}>
                  Xem<span className="sr-only"> {row.shopName}</span>
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
        <SellerDetail
          key={selected}
          id={selected}
          actorId={session.id}
          close={() => setSelected(null)}
        />
      )}
    </section>
  );
}
