import { AdminFilterBar, AdminDisclosureSummary } from '@/features/portal/components/AdminUi';
import { useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@florabot/ui';
import type { components } from '../../../../../packages/contracts/src/generated/api';
import { queryClient, request } from '@/shared/lib/api';
import { ConfirmDialog } from '../../shared/components/Modal';
import { AdminKioskSlotDetails } from './AdminKioskSlotDetails';

type Kiosk = components['schemas']['AdminKioskResponse'];
type Seller = components['schemas']['AdminSellerResponse'];

interface KioskManagerAssignmentItem {
  kioskId: string;
  kioskCode: string;
  managerId: string;
  managerName: string;
  assignedAt: string;
}

interface KioskManagerAssignmentPage {
  items: KioskManagerAssignmentItem[];
  page: number;
  hasMore: boolean;
}

interface ManagerAccountItem {
  id: string;
  fullName: string;
  email: string;
  status: string;
}

function KioskOperationsManagerPanel({ kiosks }: { kiosks: Kiosk[] }) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [selectedKioskId, setSelectedKioskId] = useState('');
  const [selectedManagerId, setSelectedManagerId] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const assignments = useQuery({
    queryKey: ['admin-kiosk-manager-assignments', page],
    queryFn: () =>
      request<KioskManagerAssignmentPage>(`/admin/kiosk-manager-assignments?page=${page}`),
    enabled: open,
  });

  const managers = useQuery({
    queryKey: ['admin-managers-list'],
    queryFn: () => request<ManagerAccountItem[]>('/admin/managers'),
    enabled: open,
  });

  const assignManager = useMutation({
    mutationFn: () =>
      request(
        `/admin/kiosks/${selectedKioskId}/operations-manager`,
        { managerId: selectedManagerId || null },
        false,
        'PUT',
      ),
    onSuccess: async () => {
      setError('');
      setNotice(
        selectedManagerId
          ? 'Đã phân công Quản lý vận hành phụ trách kiosk.'
          : 'Đã gỡ phân công Quản lý vận hành khỏi kiosk.',
      );
      await queryClient.invalidateQueries({ queryKey: ['admin-kiosk-manager-assignments'] });
    },
    onError: (err: unknown) => {
      setNotice('');
      setError(
        err instanceof Error ? err.message : 'Chưa cập nhật được phân công Quản lý vận hành.',
      );
    },
  });

  return (
    <details
      className="shop-profile"
      style={{ marginTop: '1rem' }}
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary>
        <strong>Phân công Quản lý vận hành phụ trách Kiosk</strong>
      </summary>
      {open && (
        <div style={{ marginTop: '0.75rem' }}>
          <form
            className="approval-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (selectedKioskId && !assignManager.isPending) {
                assignManager.mutate();
              }
            }}
          >
            <label htmlFor="ops-manager-kiosk">Chọn kiosk</label>
            <select
              id="ops-manager-kiosk"
              value={selectedKioskId}
              onChange={(e) => setSelectedKioskId(e.target.value)}
            >
              <option value="">Chọn kiosk</option>
              {kiosks.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name} · {k.code}
                </option>
              ))}
            </select>

            <label htmlFor="ops-manager-account">
              Quản lý vận hành phụ trách (để trống nếu muốn gỡ phân công)
            </label>
            <select
              id="ops-manager-account"
              value={selectedManagerId}
              onChange={(e) => setSelectedManagerId(e.target.value)}
            >
              <option value="">— Không gán (Gỡ phân công) —</option>
              {managers.data
                ?.filter((m) => m.status === 'ACTIVE')
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.fullName} · {m.email}
                  </option>
                ))}
            </select>

            <Button type="submit" disabled={!selectedKioskId || assignManager.isPending}>
              {assignManager.isPending ? 'Đang lưu…' : 'Lưu phân công vận hành'}
            </Button>
          </form>

          {(error || notice) && (
            <p role={error ? 'alert' : 'status'} className={error ? 'error' : undefined}>
              {error || notice}
            </p>
          )}

          {assignments.isPending && <p role="status">Đang tải danh sách phân công…</p>}
          {assignments.data && assignments.data.items.length > 0 && (
            <>
              <ul className="admin-shop-list" style={{ marginTop: '0.75rem' }}>
                {assignments.data.items.map((item) => (
                  <li key={`${item.kioskId}-${item.managerId}`} className="shop-profile">
                    <p>
                      <strong>Kiosk {item.kioskCode}</strong> → Quản lý vận hành:{' '}
                      <strong>{item.managerName}</strong>
                    </p>
                    <p className="quiet">
                      Phân công lúc: {new Date(item.assignedAt).toLocaleString('vi-VN')}
                    </p>
                  </li>
                ))}
              </ul>
              <div className="stock-actions" style={{ marginTop: '0.5rem' }}>
                <Button
                  type="button"
                  variant="outline"
                  disabled={page <= 1 || assignments.isFetching}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Trang trước
                </Button>
                <span>Trang {page}</span>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!assignments.data.hasMore || assignments.isFetching}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Trang sau
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </details>
  );
}

const kioskStatuses: Record<string, string> = {
  ONLINE: 'Trực tuyến',
  OFFLINE: 'Mất kết nối',
  MAINTENANCE: 'Bảo trì',
  DISABLED: 'Ngừng hoạt động',
};

const guidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const schema = z.object({
  sellerId: z.string().regex(guidPattern, 'Chọn shop sẽ quản lý kiosk này.'),
});

function Assignment({
  kiosk,
  sellers,
  onAssigned,
}: {
  kiosk: Kiosk;
  sellers: Seller[];
  onAssigned: (message: string) => void;
}) {
  const [pendingValues, setPendingValues] = useState<z.infer<typeof schema> | null>(null);
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    mode: 'onBlur',
    reValidateMode: 'onChange',
    defaultValues: { sellerId: kiosk.sellerId ?? '' },
  });
  const selectedSeller = sellers.find((seller) => seller.id === pendingValues?.sellerId);
  const assign = useMutation({
    mutationFn: (values: z.infer<typeof schema>) =>
      request('/admin/flows/assign_kiosk', {
        p_kiosk: kiosk.id,
        p_seller: values.sellerId,
      } satisfies components['schemas']['AssignKioskRequest']),
    onSuccess: async (_result, values) => {
      const seller = sellers.find((item) => item.id === values.sellerId);
      setPendingValues(null);
      onAssigned(
        `Đã gán toàn bộ kiosk ${kiosk.name} cho ${seller?.shopName || 'shop đã chọn'}. Shop có thể quản lý ${kiosk.slotCount} ô của kiosk này.`,
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-kiosks'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-slots'] }),
      ]);
    },
    onError: () => setPendingValues(null),
  });

  const canAssign = kiosk.status !== 'DISABLED' && kiosk.status !== 'MAINTENANCE';

  return (
    <>
      <form
        className="approval-form"
        noValidate
        onSubmit={form.handleSubmit((values) => setPendingValues(values))}
      >
        <label htmlFor={`kiosk-seller-${kiosk.id}`}>Shop quản lý toàn bộ kiosk</label>
        <select
          id={`kiosk-seller-${kiosk.id}`}
          {...form.register('sellerId')}
          disabled={assign.isPending || !canAssign}
          aria-invalid={!!form.formState.errors.sellerId}
          aria-describedby={`kiosk-error-${kiosk.id} kiosk-help-${kiosk.id}`}
        >
          <option value="">Chọn shop</option>
          {sellers.map((seller) => (
            <option key={seller.id} value={seller.id}>
              {seller.shopName} · {seller.phone}
            </option>
          ))}
        </select>
        {form.formState.errors.sellerId && (
          <p id={`kiosk-error-${kiosk.id}`} className="error">
            {form.formState.errors.sellerId.message}
          </p>
        )}
        <p id={`kiosk-help-${kiosk.id}`} className="quiet">
          Thao tác áp dụng cho toàn bộ {kiosk.slotCount} ô. Hệ thống chỉ cho phép chuyển shop khi
          các ô không có hoa, không bị giữ và không bị khóa.
        </p>
        {!canAssign && (
          <p className="quiet">Kiosk đang bảo trì hoặc ngừng hoạt động nên chưa thể phân bổ.</p>
        )}
        <Button type="submit" disabled={!sellers.length || assign.isPending || !canAssign}>
          {kiosk.sellerId ? 'Chuyển kiosk sang shop khác' : 'Gán kiosk cho shop'}
        </Button>
        {assign.isError && (
          <p className="error" role="alert">
            {assign.error.message}
          </p>
        )}
      </form>
      <ConfirmDialog
        open={pendingValues !== null}
        title={kiosk.sellerId ? 'Xác nhận chuyển kiosk' : 'Xác nhận gán kiosk'}
        description={`Toàn bộ ${kiosk.slotCount} ô của ${kiosk.name} sẽ thuộc quyền quản lý của ${selectedSeller?.shopName || 'shop đã chọn'}. Hệ thống sẽ từ chối nếu kiosk còn hoa hoặc đang có giao dịch.`}
        confirmLabel={kiosk.sellerId ? 'Chuyển kiosk' : 'Gán toàn bộ kiosk'}
        pending={assign.isPending}
        onCancel={() => {
          if (!assign.isPending) setPendingValues(null);
        }}
        onConfirm={() => {
          if (pendingValues) assign.mutate(pendingValues);
        }}
      />
    </>
  );
}

export default function AdminSlots() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [ownership, setOwnership] = useState('UNASSIGNED');
  const [confirmation, setConfirmation] = useState('');
  const notice = useRef<HTMLParagraphElement>(null);
  const kiosks = useQuery({
    queryKey: ['admin-kiosks'],
    queryFn: () => request<Kiosk[]>('/admin/kiosks'),
  });
  const sellers = useQuery({
    queryKey: ['admin-sellers', 'ACTIVE'],
    queryFn: () => request<Seller[]>('/admin/sellers?status=ACTIVE'),
  });
  const normalizedSearch = search.trim().toLocaleLowerCase('vi');
  const visible = kiosks.data?.filter(
    (kiosk) =>
      (!status || kiosk.status === status) &&
      (ownership === 'ALL' ||
        (ownership === 'ASSIGNED' ? kiosk.sellerId !== null : kiosk.sellerId === null)) &&
      `${kiosk.code} ${kiosk.name} ${kiosk.sellerName ?? ''}`
        .toLocaleLowerCase('vi')
        .includes(normalizedSearch),
  );

  return (
    <section className="admin-slots" aria-labelledby="admin-slots-title">
      <h2 id="admin-slots-title">Phân bổ kiosk cho shop</h2>
      <p>
        Mỗi kiosk chỉ thuộc một shop. Khi gán thành công, shop được quản lý toàn bộ các ô trong
        kiosk thay vì nhận từng ô riêng lẻ.
      </p>
      <AdminFilterBar
        actions={
          <>
            {' '}
            <Button
              onClick={() => {
                void kiosks.refetch();
                void sellers.refetch();
              }}
              disabled={kiosks.isFetching || sellers.isFetching}
            >
              Làm mới danh sách kiosk
            </Button>
            {(search || status || ownership !== 'UNASSIGNED') && (
              <Button
                variant="outline"
                onClick={() => {
                  setSearch('');
                  setStatus('');
                  setOwnership('UNASSIGNED');
                }}
              >
                Đặt lại bộ lọc
              </Button>
            )}
          </>
        }
      >
        <div>
          <label htmlFor="kiosk-search">Tìm mã kiosk, tên kiosk hoặc shop</label>
          <input
            id="kiosk-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div>
          <label htmlFor="kiosk-ownership">Lọc phân bổ</label>
          <select
            id="kiosk-ownership"
            value={ownership}
            onChange={(event) => setOwnership(event.target.value)}
          >
            <option value="UNASSIGNED">Chưa gán shop</option>
            <option value="ASSIGNED">Đã gán shop</option>
            <option value="ALL">Tất cả kiosk</option>
          </select>
        </div>
        <div>
          <label htmlFor="kiosk-status">Lọc trạng thái kiosk</label>
          <select
            id="kiosk-status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="">Tất cả trạng thái</option>
            {Object.entries(kioskStatuses).map(([value, name]) => (
              <option key={value} value={value}>
                {name}
              </option>
            ))}
          </select>
        </div>
      </AdminFilterBar>
      <p className="quiet">
        Chỉ shop đang hoạt động và có gói hợp lệ mới được nhận kiosk. Hệ thống kiểm tra hạn mức số ô
        trước khi xác nhận.
      </p>
      <p role="status" ref={notice} tabIndex={-1}>
        {confirmation}
      </p>
      {kiosks.isPending && <p role="status">Đang tải danh sách kiosk…</p>}
      {kiosks.isError && (
        <p className="error" role="alert">
          Chưa tải được kiosk. Chọn “Làm mới danh sách kiosk” để thử lại.
        </p>
      )}
      {sellers.isError && (
        <p className="error" role="alert">
          Chưa tải được shop đang hoạt động. Chọn “Làm mới danh sách kiosk” để thử lại.
        </p>
      )}
      {visible?.length === 0 && <p>Không có kiosk phù hợp với bộ lọc hiện tại.</p>}
      <ul className="admin-shop-list">
        {visible?.map((kiosk) => (
          <li key={kiosk.id}>
            <details>
              <AdminDisclosureSummary
                statusCode={kiosk.status}
                title={kiosk.name}
                meta={kiosk.code}
                status={kioskStatuses[kiosk.status] || kiosk.status}
              />
              <div className="shop-profile">
                <dl>
                  <div>
                    <dt>Số ô</dt>
                    <dd>{kiosk.slotCount}</dd>
                  </div>
                  <div>
                    <dt>Shop đang quản lý</dt>
                    <dd>{kiosk.sellerName || 'Chưa có'}</dd>
                  </div>
                  <div>
                    <dt>Trạng thái</dt>
                    <dd>{kioskStatuses[kiosk.status] || kiosk.status}</dd>
                  </div>
                </dl>
                <AdminKioskSlotDetails kioskId={kiosk.id} kioskCode={kiosk.code} />
                {sellers.isPending ? (
                  <p role="status">Đang tải shop…</p>
                ) : sellers.data?.length ? (
                  <Assignment
                    kiosk={kiosk}
                    sellers={sellers.data}
                    onAssigned={(message) => {
                      setConfirmation(message);
                      notice.current?.focus();
                    }}
                  />
                ) : (
                  <p>Chưa có shop đang hoạt động và đủ điều kiện nhận kiosk.</p>
                )}
              </div>
            </details>
          </li>
        ))}
      </ul>
      <KioskOperationsManagerPanel kiosks={kiosks.data ?? []} />
    </section>
  );
}
