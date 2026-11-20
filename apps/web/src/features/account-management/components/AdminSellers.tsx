import { liveListOptions } from '@/shared/lib/live-list';
import WorkspaceTable from '@/features/portal/components/WorkspaceTable';
import { AdminFilterBar } from '@/features/portal/components/AdminUi';
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
    : '—';

export default function AdminSellers() {
  const { t } = useTranslation();
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const sellers = useQuery({
    ...liveListOptions(),
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
      <AdminFilterBar
        actions={
          <>
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
      {pageItems.length > 0 && (
        <WorkspaceTable label="Danh sách shop hoa">
          <table>
            <thead>
              <tr>
                <th scope="col">Shop</th>
                <th scope="col">Liên hệ</th>
                <th scope="col">Hạn thuê gần nhất</th>
                <th scope="col">Trạng thái</th>
                <th scope="col">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((seller) => (
                <tr key={seller.id}>
                  <td>
                    <strong>{seller.shopName}</strong>
                  </td>
                  <td>
                    {seller.phone || '—'}
                    <span className="table-secondary">{seller.address || '—'}</span>
                  </td>
                  <td>{leaseExpiry(seller.packageExpiresAt)}</td>
                  <td>
                    <span className="table-badge" data-state={seller.status}>
                      {t(`status.${seller.status}`)}
                    </span>
                  </td>
                  <td>
                    <Link href={`/admin/reports?sellerId=${encodeURIComponent(seller.id)}`}>
                      Báo cáo
                    </Link>
                    {seller.status === 'PENDING' && (
                      <Link href="/admin/installations">Hồ sơ thuê</Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </WorkspaceTable>
      )}
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
