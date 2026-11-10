import { AdminFilterBar, AdminDisclosureSummary } from '@/features/portal/components/AdminUi';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Button } from '@florabot/ui';
import Link from 'next/link';
import type { components } from '../../../../../../packages/contracts/src/generated/api';
import { request } from '@/shared/lib/api';
import { TablePagination } from '../../../shared/components/DataTable';
import { clampPage, paginate } from '../../../shared/pagination';

type Seller = components['schemas']['AdminSellerResponse'];
const PAGE_SIZE = 10;

const leaseExpiry = (value: string | null) =>
  value
    ? new Date(`${value}T00:00:00+07:00`).toLocaleDateString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
      })
    : 'Chưa có kỳ thuê kiosk đang hiệu lực';

export default function AdminSellers() {
  const { t } = useTranslation();
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const sellers = useQuery({
    queryKey: ['admin-sellers', status],
    queryFn: () => request<Seller[]>(`/admin/sellers${status ? `?status=${status}` : ''}`),
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
          Đăng ký mở shop mới được theo dõi ở mục{' '}
          <Link href="/admin/installations">Hồ sơ thuê kiosk</Link>.
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
      {sellers.isPending && <p role="status">Đang tải hồ sơ shop…</p>}
      {sellers.isError && (
        <div className="admin-sellers-error">
          <p role="alert" className="error">
            {sellers.error.message}
          </p>
          <Button onClick={() => void sellers.refetch()}>Tải lại hồ sơ</Button>
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
                    <dt>Hạn thuê kiosk gần nhất</dt>
                    <dd>{leaseExpiry(seller.packageExpiresAt)}</dd>
                  </div>
                </dl>
                {seller.status === 'PENDING' && (
                  <p className="quiet">
                    Shop đang chờ xử lý hồ sơ thuê kiosk. Theo dõi tiến độ tại{' '}
                    <Link href="/admin/installations">Hồ sơ thuê kiosk</Link>.
                  </p>
                )}
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
