'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, Plus, Minus, Search } from '@florabot/ui';
import { money } from '@florabot/contracts';
import type { Session } from '../../api';
import { TablePagination } from '../../shared/components/DataTable';
import { Modal } from '../../shared/components/Modal';
import { clampPage, paginate } from '../../shared/pagination';
import { fetchProducts, fetchSellerKiosks } from './product.api';
import type { Product, SellerKiosk } from './product.types';
import { PAGE_SIZE, statusNames } from './product.types';
import { errorText } from './product.utils';
import ProductEditor from './components/ProductEditor';
import { ProductCreateForm } from './components/ProductCatalogForm';
import './styles/products.css';

export default function ProductManagement({ session }: { session: Session }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createNotice, setCreateNotice] = useState('');
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);
  const createNoticeRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (!createNotice) return;
    createNoticeRef.current?.focus();
  }, [createNotice]);

  const sellerId = session.sellerId;
  const query = useQuery<Product[]>({
    queryKey: ['products', sellerId],
    queryFn: fetchProducts,
    enabled: !!sellerId,
  });

  const kiosks = useQuery<SellerKiosk[]>({
    queryKey: ['seller-kiosks', sellerId],
    queryFn: () => fetchSellerKiosks(sellerId!),
    enabled: !!sellerId,
  });

  if (!sellerId) {
    return <p role="alert">Tài khoản chưa gắn với shop. Vui lòng liên hệ đội ngũ vận hành.</p>;
  }

  const canEdit = session.sellerStatus === 'ACTIVE';
  const products = query.data?.filter(
    (product) =>
      product.name.toLocaleLowerCase('vi').includes(search.trim().toLocaleLowerCase('vi')) &&
      (filter === 'ALL' || filter === product.status),
  );
  const safePage = clampPage(page, products?.length ?? 0, PAGE_SIZE);
  const pageItems = paginate(products ?? [], safePage, PAGE_SIZE);

  return (
    <section className="products" aria-labelledby="products-title">
      <h2 id="products-title">Những bó hoa của shop</h2>
      <p>Chọn một sản phẩm để xem mô tả, điều chỉnh giá hoặc tạm ngừng bán.</p>
      {!canEdit && (
        <p className="quiet">
          Shop cần có gói đang hoạt động để chỉnh sửa sản phẩm. Bạn vẫn có thể xem danh sách.
        </p>
      )}
      <div className="product-toolbar">
        <div className="product-filters">
          <div className="filter-group">
            <label htmlFor="product-search" className="sr-only">
              Tìm tên sản phẩm
            </label>
            <div className="product-search-wrapper">
              <Search size={18} className="product-search-icon" aria-hidden="true" />
              <input
                id="product-search"
                type="search"
                aria-label="Tìm tên sản phẩm"
                placeholder="Tìm tên sản phẩm…"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>
          <div className="filter-group">
            <label htmlFor="product-filter" className="sr-only">
              Lọc trạng thái
            </label>
            <select
              id="product-filter"
              aria-label="Lọc trạng thái"
              value={filter}
              onChange={(event) => {
                setFilter(event.target.value);
                setPage(1);
              }}
            >
              <option value="ALL">Tất cả trạng thái</option>
              {Object.entries(statusNames).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="product-actions-bar">
          <Button
            type="button"
            onClick={() => {
              setCreateNotice('');
              setShowCreateForm(!showCreateForm);
            }}
            disabled={!canEdit || kiosks.isPending || !kiosks.data?.length}
            aria-expanded={showCreateForm}
            aria-controls="product-create-section"
          >
            <Plus size={18} aria-hidden="true" />
            {showCreateForm ? 'Đóng biểu mẫu thêm hoa' : 'Thêm bó hoa giả mới'}
          </Button>
        </div>
      </div>
      {showCreateForm && (
        <Modal
          open
          title="Thêm bó hoa giả mới"
          description="Nhập thông tin mẫu hoa trước khi đưa vào danh mục của shop."
          onClose={() => setShowCreateForm(false)}
        >
          <div id="product-create-section" className="product-create-container">
            <ProductCreateForm
              sellerId={sellerId}
              kiosks={kiosks.data ?? []}
              canEdit={canEdit}
              onSuccess={(createdProductId) => {
                setShowCreateForm(false);
                if (createdProductId) {
                  setExpandedProductId(createdProductId);
                }
                setCreateNotice('Đã tạo mẫu hoa giả mới ở trạng thái Bản nháp.');
              }}
              onCancel={() => setShowCreateForm(false)}
            />
          </div>
        </Modal>
      )}
      {kiosks.isError && (
        <p className="error" role="alert">
          Chưa tải được kiosk của shop nên chưa thể tạo sản phẩm mới.
        </p>
      )}
      {!kiosks.isPending && !kiosks.isError && kiosks.data?.length === 0 && (
        <p className="quiet">Shop cần được phân bổ ít nhất một kiosk trước khi tạo sản phẩm mới.</p>
      )}
      <p ref={createNoticeRef} role="status" tabIndex={-1}>
        {createNotice}
      </p>
      {query.isPending && <p role="status">Đang tải sản phẩm…</p>}
      {query.error && (
        <div>
          <p role="alert" className="error">
            {errorText(query.error)}
          </p>
          <Button variant="outline" onClick={() => void query.refetch()}>
            Tải lại sản phẩm
          </Button>
        </div>
      )}
      {products?.length === 0 && (
        <p className="seller-empty-state" role="status">
          {query.data?.length
            ? 'Không có sản phẩm phù hợp. Thử tên khác hoặc chọn tất cả trạng thái.'
            : 'Shop chưa có sản phẩm. Liên hệ đội ngũ để hoàn tất danh mục trước khi nạp hoa.'}
        </p>
      )}
      <ul className="product-list">
        {pageItems.map((product) => (
          <li key={product.id}>
            <details
              open={expandedProductId === product.id ? true : undefined}
              onToggle={(event) => {
                if (!event.currentTarget.open && expandedProductId === product.id) {
                  setExpandedProductId(null);
                }
              }}
            >
              <summary>
                <span>
                  <strong>{product.name}</strong>
                  {product.inventoryKind === 'ARTIFICIAL' && (
                    <span className="product-kind-badge">Hoa giả</span>
                  )}
                  {product.inventoryKind === 'LEGACY_FRESH' && (
                    <span className="product-kind-badge legacy">Dữ liệu cũ chưa chuyển đổi</span>
                  )}
                  <span className="product-status" data-status={product.status}>
                    {statusNames[product.status] || product.status}
                  </span>
                </span>
                <span className="product-price">{money(Number(product.price))}</span>
                <Plus className="expand-icon" size={20} aria-hidden="true" />
                <Minus className="collapse-icon" size={20} aria-hidden="true" />
              </summary>
              <ProductEditor product={product} sellerId={sellerId} canEdit={canEdit} />
            </details>
          </li>
        ))}
      </ul>
      {(products?.length ?? 0) > 0 && (
        <TablePagination
          page={safePage}
          pageSize={PAGE_SIZE}
          totalItems={products?.length ?? 0}
          onPageChange={setPage}
          ariaLabel="Phân trang danh sách sản phẩm"
        />
      )}
    </section>
  );
}
