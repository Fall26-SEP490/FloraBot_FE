import { AdminFilterBar, AdminDisclosureSummary } from '@/features/portal/components/AdminUi';
import { useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { Button } from '@florabot/ui';
import Link from 'next/link';
import type { components } from '../../../../../../packages/contracts/src/generated/api';
import { queryClient, request } from '@/shared/lib/api';
import { TablePagination } from '../../../shared/components/DataTable';
import { clampPage, paginate } from '../../../shared/pagination';

type Seller = components['schemas']['AdminSellerResponse'];
type Package = components['schemas']['PackageResponse'];
const schema = z.object({ packageId: z.string().min(1, 'Chọn gói thuê đã thống nhất với shop.') });
const money = (value: number | string) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(value));
const PAGE_SIZE = 10;

function Approval({
  seller,
  packages,
  onApproved,
}: {
  seller: Seller;
  packages: Package[];
  onApproved: (name: string) => void;
}) {
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { packageId: '' },
  });
  const approve = useMutation({
    mutationFn: (values: z.infer<typeof schema>) =>
      request('/admin/flows/approve_seller', { p_seller: seller.id, p_package: values.packageId }),
    onSuccess: async () => {
      onApproved(seller.shopName);
      await queryClient.invalidateQueries({ queryKey: ['admin-sellers'] });
    },
  });
  return (
    <form
      className="approval-form"
      noValidate
      onSubmit={form.handleSubmit((values) => approve.mutate(values))}
    >
      <h4>Phê duyệt shop theo luồng cũ</h4>
      <label htmlFor={`package-${seller.id}`}>Gói thuê cho {seller.shopName}</label>
      <select
        id={`package-${seller.id}`}
        {...form.register('packageId')}
        aria-invalid={!!form.formState.errors.packageId}
        aria-describedby={`package-error-${seller.id} approval-help-${seller.id}`}
        disabled={approve.isPending}
      >
        <option value="">Chọn gói thuê</option>
        {packages.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name} · {money(item.monthlyFee)}/tháng · {item.maxSlots} ô
          </option>
        ))}
      </select>
      <p id={`package-error-${seller.id}`} className="error">
        {form.formState.errors.packageId?.message}
      </p>
      <p id={`approval-help-${seller.id}`} className="quiet">
        Duyệt hồ sơ chưa thu phí hay mở bán. Shop thanh toán gói, sau đó quản trị viên mới gán ô tủ
        phù hợp.
      </p>
      <Button type="submit" disabled={!packages.length || approve.isPending}>
        {approve.isPending ? 'Đang duyệt…' : 'Duyệt hồ sơ shop'}
      </Button>
      {approve.isError && (
        <p role="alert" className="error">
          {approve.error.message}
        </p>
      )}
    </form>
  );
}

export default function AdminSellers() {
  const { t } = useTranslation();
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [approved, setApproved] = useState('');
  const confirmation = useRef<HTMLParagraphElement>(null);
  const sellers = useQuery({
    queryKey: ['admin-sellers', status],
    queryFn: () => request<Seller[]>(`/admin/sellers${status ? `?status=${status}` : ''}`),
  });
  const packages = useQuery({
    queryKey: ['packages'],
    queryFn: () => request<Package[]>('/packages'),
  });
  const visible = sellers.data?.filter((row) =>
    `${row.shopName} ${row.phone}`
      .toLocaleLowerCase('vi')
      .includes(search.trim().toLocaleLowerCase('vi')),
  );
  const safePage = clampPage(page, visible?.length ?? 0, PAGE_SIZE);
  const pageItems = paginate(visible ?? [], safePage, PAGE_SIZE);
  return (
    <section className="admin-sellers" aria-labelledby="admin-sellers-title">
      <h2 id="admin-sellers-title">Hồ sơ các shop hoa</h2>
      <div className="status-notice notice-info">
        <p>
          Hồ sơ khách hàng đăng ký mở shop và thuê kiosk nằm ở mục{' '}
          <Link href="/admin/installations">Hồ sơ thuê kiosk</Link>. Admin theo dõi; Quản lý vận
          hành xác nhận liên hệ, phân công kỹ thuật viên và bàn giao. Danh sách bên dưới là các shop
          đã có trong hệ thống.
        </p>
      </div>
      <AdminFilterBar
        actions={
          <>
            <Button
              variant="outline"
              disabled={sellers.isFetching}
              onClick={() => void sellers.refetch()}
            >
              Cập nhật danh sách
            </Button>
            {(search || status) && (
              <Button
                variant="outline"
                onClick={() => {
                  setSearch('');
                  setStatus('');
                  setPage(1);
                }}
              >
                Xóa bộ lọc
              </Button>
            )}
          </>
        }
      >
        <div>
          <label htmlFor="shop-search">Tìm tên shop hoặc số điện thoại</label>
          <input
            id="shop-search"
            type="search"
            placeholder="Nhập tên shop hoặc số điện thoại…"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </div>
        <div>
          <label htmlFor="shop-status">Lọc trạng thái shop</label>
          <select
            id="shop-status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
          >
            <option value="">Tất cả trạng thái</option>
            {['PENDING', 'APPROVED', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CLOSED'].map((value) => (
              <option key={value} value={value}>
                {t(`status.${value}`)}
              </option>
            ))}
          </select>
        </div>
      </AdminFilterBar>
      <p className="quiet">
        Hiển thị tối đa 100 hồ sơ mới nhất, chia thành từng trang để dễ theo dõi.
      </p>
      <p ref={confirmation} role="status" tabIndex={-1}>
        {approved ? `Đã duyệt ${approved}. Shop cần thanh toán gói để bắt đầu mở bán.` : ''}
      </p>
      {sellers.isPending && <p role="status">Đang tải hồ sơ shop…</p>}
      {sellers.isError && (
        <div className="admin-sellers-error">
          <p role="alert" className="error">
            {sellers.error.message}
          </p>
          <Button onClick={() => void sellers.refetch()}>Tải lại hồ sơ</Button>
        </div>
      )}
      {packages.isError && (
        <div className="admin-sellers-error">
          <p role="alert" className="error">
            Chưa tải được các gói thuê. Bạn cần tải lại trước khi duyệt.
          </p>
          <Button onClick={() => void packages.refetch()}>Tải lại gói thuê</Button>
        </div>
      )}
      {visible?.length === 0 && <p>Không có hồ sơ phù hợp với bộ lọc hiện tại.</p>}
      <ul className="admin-shop-list">
        {pageItems.map((seller) => (
          <li key={seller.id}>
            <details>
              <AdminDisclosureSummary
                statusCode={seller.status}
                title={seller.shopName}
                meta={seller.phone || 'Chưa có số điện thoại'}
                status={t(`status.${seller.status}`)}
              />
              <div className="shop-profile">
                <dl>
                  <div>
                    <dt>Số điện thoại</dt>
                    <dd>{seller.phone}</dd>
                  </div>
                  <div>
                    <dt>Địa chỉ / khu vực</dt>
                    <dd>{seller.address || 'Chưa cung cấp'}</dd>
                  </div>
                  <div>
                    <dt>Gói đã duyệt</dt>
                    <dd>
                      {packages.data?.find((item) => item.id === seller.packageId)?.name ||
                        'Chưa có thông tin gói đang mở'}
                    </dd>
                  </div>
                </dl>
                {seller.status === 'PENDING' &&
                  (packages.isPending ? (
                    <p role="status">Đang tải gói thuê…</p>
                  ) : (
                    packages.data && (
                      <Approval
                        seller={seller}
                        packages={packages.data}
                        onApproved={(name) => {
                          setApproved(name);
                          confirmation.current?.focus();
                        }}
                      />
                    )
                  ))}
              </div>
            </details>
          </li>
        ))}
      </ul>
      {(visible?.length ?? 0) > 0 && (
        <TablePagination
          page={safePage}
          pageSize={PAGE_SIZE}
          totalItems={visible?.length ?? 0}
          onPageChange={setPage}
          ariaLabel="Phân trang hồ sơ shop hoa"
        />
      )}
    </section>
  );
}
