'use client';

import RefreshRegion from '@/shared/components/RefreshRegion';
import IconActionButton from '@/shared/components/IconActionButton';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Button, Plus, Search } from '@florabot/ui';
import { money } from '@florabot/contracts';
import { type Session } from '@/shared/lib/api';
import Select from '@/shared/components/Select';
import SidePanel from '@/shared/components/SidePanel';
import { TablePagination } from '@/shared/components/DataTable';
import { Modal } from '@/shared/components/Modal';
import { clampPage, paginate } from '@/shared/pagination';
import { fetchProducts } from './product.api';
import type { Product } from './product.types';
import { PAGE_SIZE, statusNames } from './product.types';
import { errorText } from './product.utils';
import ProductEditor from './components/ProductEditor';
import ProductThumbnail from './components/ProductThumbnail';
import { ProductCreateForm } from './components/ProductCatalogForm';
import styles from './styles/seller-catalog.module.css';
import './styles/products.css';

export default function ProductManagement({ session }: { session: Session }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createNotice, setCreateNotice] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const sellerId = session.sellerId;
  const query = useQuery<Product[]>({
    queryKey: ['products', sellerId],
    queryFn: fetchProducts,
    enabled: !!sellerId,
  });
  if (!sellerId)
    return <p role="alert">Tài khoản chưa gắn với shop. Vui lòng liên hệ đội ngũ vận hành.</p>;
  const canEdit = session.sellerStatus === 'ACTIVE';
  const allProducts = query.data ?? [];
  const needle = search.trim().toLocaleLowerCase('vi');
  const filtered = allProducts
    .filter(
      (product) =>
        (filter === 'ALL' || product.status === filter) &&
        (!needle ||
          [product.name, ...(product.tags ?? [])]
            .join(' ')
            .toLocaleLowerCase('vi')
            .includes(needle)),
    )
    .sort((a, b) => Number(b.id === createdId) - Number(a.id === createdId));
  const safePage = clampPage(page, filtered.length, PAGE_SIZE);
  const selected = allProducts.find((product) => product.id === selectedId);
  return (
    <div
      id="seller-products"
      className={styles.catalog}
      role="region"
      aria-label="Danh mục mẫu hoa"
    >
      {!canEdit && (
        <p className={styles.notice} role="status">
          Shop cần có gói đang hoạt động để thêm hoặc chỉnh sửa mẫu hoa.
        </p>
      )}
      {createNotice && (
        <p className={styles.notice} role="status">
          {createNotice}
        </p>
      )}
      <RefreshRegion>
        <div className={styles.surface}>
          <div className={styles.toolbar}>
            <label className={styles.searchField}>
              <span>Tìm mẫu hoa</span>
              <span className={styles.searchInput}>
                <Search size={18} aria-hidden="true" />
                <input
                  id="product-search"
                  type="search"
                  placeholder="Tên mẫu hoa hoặc từ khóa"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                />
              </span>
            </label>
            <label className={styles.stateField} htmlFor="product-state">
              <span>Trạng thái</span>
              <Select
                id="product-state"
                value={filter}
                onChange={(event) => {
                  setFilter(event.target.value);
                  setPage(1);
                }}
              >
                <option value="ALL">Tất cả</option>
                {Object.entries(statusNames).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </label>
            {canEdit && (
              <Button
                type="button"
                onClick={() => {
                  setCreateNotice('');
                  setShowCreateForm(true);
                }}
              >
                <Plus size={17} aria-hidden="true" />
                Thêm mẫu hoa
              </Button>
            )}
            <IconActionButton
              action="reload"
              label="Tải lại mẫu hoa"
              disabled={query.isFetching}
              onClick={() => query.refetch()}
            />
          </div>
          <div className={`${styles.columns} ${styles.productGrid}`} aria-hidden="true">
            <span>Mẫu hoa</span>
            <span>Kích thước (cm)</span>
            <span>Giá bán</span>
            <span>Tồn tại shop</span>
            <span>Trạng thái</span>
            <span />
          </div>
          {query.isPending && (
            <p className={styles.empty} role="status">
              Đang tải mẫu hoa…
            </p>
          )}
          {query.isError && (
            <div className={`${styles.empty} product-error-box`} role="alert">
              <p>{errorText(query.error)}</p>
              <IconActionButton
                variant="outline"
                onClick={() => query.refetch()}
                action="reload"
                label="Tải lại sản phẩm"
              />
            </div>
          )}
          {!query.isPending && !query.isError && !filtered.length && (
            <div className={`${styles.empty} product-empty-state`} role="status">
              <strong>
                {allProducts.length ? 'Không tìm thấy mẫu hoa phù hợp' : 'Chưa có mẫu hoa'}
              </strong>
              <p>
                {allProducts.length
                  ? 'Thử đổi từ khóa hoặc trạng thái.'
                  : 'Thêm mẫu hoa đầu tiên cho cửa hàng.'}
              </p>
            </div>
          )}
          <ul className={`${styles.list} product-order-list`}>
            {paginate(filtered, safePage, PAGE_SIZE).map((product) => (
              <li key={product.id}>
                <button
                  type="button"
                  className={`${styles.row} ${styles.productGrid} product-order-summary`}
                  aria-label={`Xem mẫu hoa ${product.name}`}
                  onClick={() => setSelectedId(product.id)}
                >
                  <span className={styles.productIdentity}>
                    <ProductThumbnail
                      sellerId={sellerId}
                      productId={product.id}
                      productName={product.name}
                      className={styles.thumbnail}
                    />
                    <span>
                      <strong>{product.name}</strong>
                      <small>
                        {product.tags?.map((tag) => `#${tag}`).join(' ') || 'Chưa có từ khóa'}
                      </small>
                    </span>
                  </span>
                  <span className={styles.dimension}>
                    {product.lengthCm && product.widthCm && product.heightCm
                      ? `${product.lengthCm} × ${product.widthCm} × ${product.heightCm}`
                      : '—'}
                  </span>
                  <span className={styles.price}>{money(Number(product.price))}</span>
                  <span className={styles.stock}>
                    {product.quantity == null ? '—' : `${product.quantity} bó`}
                  </span>
                  <span className={styles.status}>
                    <span className={styles.badge} data-active={product.status === 'ACTIVE'}>
                      {statusNames[product.status] || product.status}
                    </span>
                  </span>
                  <span className={styles.arrow}>
                    <ArrowRight size={16} aria-hidden="true" />
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {filtered.length > 0 && (
            <div className={styles.pagination}>
              <TablePagination
                centered
                page={safePage}
                pageSize={PAGE_SIZE}
                totalItems={filtered.length}
                onPageChange={setPage}
                ariaLabel="Phân trang danh sách sản phẩm"
              />
            </div>
          )}
        </div>
      </RefreshRegion>
      {selected && (
        <SidePanel title={selected.name} onClose={() => setSelectedId(null)}>
          <div className={`${styles.editor} seller-products`}>
            <ProductEditor
              key={selected.id}
              product={selected}
              sellerId={sellerId}
              canEdit={canEdit}
            />
          </div>
        </SidePanel>
      )}
      {showCreateForm && (
        <Modal
          open
          size="lg"
          className="product-form-modal product-create-modal"
          title="Thêm mẫu hoa"
          onClose={() => setShowCreateForm(false)}
        >
          <div id="product-create-section" className="product-create-container">
            <ProductCreateForm
              sellerId={sellerId}
              canEdit={canEdit}
              onSuccess={(id) => {
                setShowCreateForm(false);
                if (id) {
                  setSearch('');
                  setFilter('DRAFT');
                  setPage(1);
                  setCreatedId(id);
                  setSelectedId(id);
                }
                setCreateNotice('Đã tạo bản mẫu. Thêm ảnh mẫu trước khi bật bán.');
              }}
              onCancel={() => setShowCreateForm(false)}
            />
          </div>
        </Modal>
      )}
    </div>
  );
}
