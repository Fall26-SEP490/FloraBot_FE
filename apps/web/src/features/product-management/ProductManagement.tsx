'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Boxes,
  Button,
  ChevronDown,
  CircleAlert,
  Flower2,
  Plus,
  RefreshCw,
  Store,
} from '@florabot/ui';
import { money } from '@florabot/contracts';
import { queryClient, type Session } from '@/shared/lib/api';
import { TablePagination } from '../../shared/components/DataTable';
import { Modal } from '../../shared/components/Modal';
import { clampPage, paginate } from '../../shared/pagination';
import { fetchProducts } from './product.api';
import type { Product } from './product.types';
import { PAGE_SIZE, statusNames } from './product.types';
import { errorText } from './product.utils';
import ProductEditor from './components/ProductEditor';
import ProductThumbnail from './components/ProductThumbnail';
import { ProductCreateForm } from './components/ProductCatalogForm';
import './styles/products.css';

export default function ProductManagement({ session }: { session: Session }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'DRAFT' | 'INACTIVE'>('ALL');
  const [page, setPage] = useState(1);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createNotice, setCreateNotice] = useState('');
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);
  const createNoticeRef = useRef<HTMLParagraphElement>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const pendingScroll = useRef<string | null>(null);

  useEffect(() => {
    if (!createNotice) return;
    const target = pendingScroll.current;
    if (!target) {
      createNoticeRef.current?.focus();
      return;
    }
    const card = document.getElementById(`product-created-${target}`);
    if (card) {
      card.scrollIntoView({ block: 'start' });
      card.focus({ preventScroll: true });
      pendingScroll.current = null;
    }
  }, [createNotice, createdId]);

  const sellerId = session.sellerId;
  const query = useQuery<Product[]>({
    queryKey: ['products', sellerId],
    queryFn: fetchProducts,
    enabled: !!sellerId,
  });

  if (!sellerId) {
    return <p role="alert">Tài khoản chưa gắn với shop. Vui lòng liên hệ đội ngũ vận hành.</p>;
  }

  const canEdit = session.sellerStatus === 'ACTIVE';
  const allProducts = query.data ?? [];

  // Metrics for summary cards & tabs
  const totalCount = allProducts.length;
  const activeCount = allProducts.filter((p) => p.status === 'ACTIVE').length;
  const draftCount = allProducts.filter((p) => p.status === 'DRAFT').length;
  const inactiveCount = allProducts.filter((p) => p.status === 'INACTIVE').length;

  const normalizedSearch = search.trim().toLocaleLowerCase('vi');
  const filteredProducts = allProducts
    .filter((product) => {
      const matchSearch =
        !normalizedSearch ||
        product.name.toLocaleLowerCase('vi').includes(normalizedSearch) ||
        product.tags?.some((t) => t.toLocaleLowerCase('vi').includes(normalizedSearch));
      const matchStatus = filter === 'ALL' || product.status === filter;
      return matchSearch && matchStatus;
    })
    .sort((a, b) => Number(b.id === createdId) - Number(a.id === createdId));

  const safePage = clampPage(page, filteredProducts.length, PAGE_SIZE);
  const pageItems = paginate(filteredProducts, safePage, PAGE_SIZE);

  return (
    <div id="seller-products" className="seller-products" aria-labelledby="products-title">
      <h2 id="products-title" className="sr-only">
        Quản lý mẫu hoa
      </h2>

      {!canEdit && (
        <div className="product-alert warning" role="alert">
          <CircleAlert size={16} aria-hidden="true" />
          <p>
            Shop cần có gói đang hoạt động để chỉnh sửa hoặc tạo mới sản phẩm. Bạn hiện tại chỉ có
            quyền xem danh mục.
          </p>
        </div>
      )}

      {/* Main Filter Container - Harmonized with .filters in seller-orders */}
      <div className="product-filters-card">
        <div className="product-filter-heading">
          <div>
            <h3>Danh mục mẫu hoa</h3>
            <p>
              Quản lý mẫu hoa của shop, điều chỉnh giá bán, kích thước đóng gói và cập nhật hình
              ảnh.
            </p>
          </div>
          <div className="product-filter-actions">
            <Button
              variant="outline"
              className="product-refresh-btn"
              disabled={query.isFetching}
              onClick={() => {
                void query.refetch();
                void queryClient.invalidateQueries({ queryKey: ['product-photos', sellerId] });
              }}
              title="Tải lại danh sách mẫu hoa"
            >
              <RefreshCw
                size={15}
                aria-hidden="true"
                className={query.isFetching ? 'is-spinning' : ''}
              />
              <span>{query.isFetching ? 'Đang cập nhật…' : 'Làm mới'}</span>
            </Button>
            {canEdit && (
              <Button
                type="button"
                className="product-create-btn"
                onClick={() => {
                  setCreateNotice('');
                  setShowCreateForm(true);
                }}
                aria-expanded={showCreateForm}
                aria-controls="product-create-section"
              >
                <Plus size={15} aria-hidden="true" />
                <span>Thêm mẫu hoa</span>
              </Button>
            )}
          </div>
        </div>

        {/* Summary Stat Strip - Harmonized with .summary in seller-orders */}
        <div className="product-summary" aria-label="Thống kê mẫu hoa">
          {[
            { label: 'Tất cả', value: 'ALL' as const, count: totalCount, icon: Flower2 },
            { label: 'Đang bán', value: 'ACTIVE' as const, count: activeCount, icon: Store },
            { label: 'Bản nháp', value: 'DRAFT' as const, count: draftCount, icon: Boxes },
            {
              label: 'Tạm ngừng bán',
              value: 'INACTIVE' as const,
              count: inactiveCount,
              icon: CircleAlert,
            },
          ].map(({ label, value, count, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setFilter(value);
                setPage(1);
              }}
              aria-pressed={filter === value}
            >
              <span className="product-stat-icon">
                <Icon size={20} aria-hidden="true" />
              </span>
              <span>
                <small>{label}</small>
                <strong>{query.isError ? '—' : query.isPending ? '…' : count}</strong>
              </span>
            </button>
          ))}
        </div>

        {/* Search Bar - identical to seller-orders */}
        <div className="product-search-bar">
          <label className="product-search-field">
            <span>Tìm mẫu hoa</span>
            <input
              id="product-search"
              type="search"
              placeholder="Tên mẫu hoa hoặc từ khóa (#tag)…"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </label>
        </div>
      </div>

      {createNotice && (
        <div ref={createNoticeRef} role="status" tabIndex={-1} className="product-alert success">
          <p>{createNotice}</p>
        </div>
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
              onSuccess={(createdProductId) => {
                setShowCreateForm(false);
                if (createdProductId) {
                  setSearch('');
                  setFilter('DRAFT');
                  setPage(1);
                  setExpandedProductId(createdProductId);
                  pendingScroll.current = createdProductId;
                  setCreatedId(createdProductId);
                }
                setCreateNotice(
                  'Đã tạo bản nháp. Tiếp theo: thêm ảnh mẫu, rồi bật bán khi mẫu đã sẵn sàng.',
                );
              }}
              onCancel={() => setShowCreateForm(false)}
            />
          </div>
        </Modal>
      )}

      {query.isPending && (
        <div className="product-loading-state" role="status">
          <p>Đang tải danh sách mẫu hoa…</p>
        </div>
      )}

      {query.error && (
        <div className="product-error-box" role="alert">
          <p className="error">{errorText(query.error)}</p>
          <Button variant="outline" onClick={() => void query.refetch()}>
            Tải lại sản phẩm
          </Button>
        </div>
      )}

      {!query.isPending && !query.isError && filteredProducts.length === 0 && (
        <div className="product-empty-state" role="status">
          <Flower2 size={32} className="product-empty-icon" aria-hidden="true" />
          <h3>Không tìm thấy mẫu hoa nào</h3>
          <p>
            {allProducts.length
              ? 'Thử tìm với từ khóa khác hoặc chuyển sang tab trạng thái khác.'
              : 'Shop của bạn chưa có mẫu hoa nào. Hãy bấm "Thêm mẫu hoa" để bắt đầu kinh doanh.'}
          </p>
        </div>
      )}

      {/* Result Count */}
      {filteredProducts.length > 0 && (
        <p className="product-result-count" role="status">
          Hiển thị {pageItems.length} / {filteredProducts.length} mẫu hoa · Trang {safePage}
        </p>
      )}

      {/* Product List - Harmonized with seller-orders */}
      {filteredProducts.length > 0 && (
        <ul className="product-order-list">
          {pageItems.map((product) => (
            <li key={product.id}>
              <details
                id={`product-created-${product.id}`}
                tabIndex={-1}
                open={expandedProductId === product.id ? true : undefined}
                onToggle={(event) => {
                  if (!event.currentTarget.open && expandedProductId === product.id) {
                    setExpandedProductId(null);
                  }
                }}
              >
                <summary className="product-order-summary">
                  <div className="product-order-heading">
                    <strong>{product.name}</strong>
                    <span className="product-kind">
                      {product.inventoryKind === 'LEGACY_FRESH' ? 'Hoa tươi' : 'Hoa thành phẩm'}
                    </span>
                    <span className="product-status" data-status={product.status}>
                      {statusNames[product.status] || product.status}
                    </span>
                  </div>

                  <div className="product-order-body">
                    {/* Col 1: Product avatar & tags */}
                    <span className="product-col-main">
                      <ProductThumbnail
                        sellerId={sellerId}
                        productId={product.id}
                        productName={product.name}
                      />
                      <span>
                        <small>Từ khóa phân loại</small>
                        <span className="product-tags-wrap">
                          {product.tags && product.tags.length > 0 ? (
                            product.tags.map((tag) => (
                              <span key={tag} className="product-tag-chip">
                                #{tag}
                              </span>
                            ))
                          ) : (
                            <span className="product-quiet-text">Chưa gắn từ khóa</span>
                          )}
                        </span>
                      </span>
                    </span>

                    {/* Col 2: Kích thước */}
                    <span className="product-col-specs">
                      <small>Kích thước đóng gói (D × R × C)</small>
                      <strong>
                        {product.lengthCm && product.widthCm && product.heightCm
                          ? `${product.lengthCm} × ${product.widthCm} × ${product.heightCm} cm`
                          : 'Chưa cập nhật'}
                      </strong>
                    </span>

                    {/* Col 3: Giá bán */}
                    <span className="product-col-price">
                      <small>Giá niêm yết</small>
                      <strong className="product-price-strong">
                        {money(Number(product.price))}
                      </strong>
                      <small>Tồn bó tại shop</small>
                      <strong>
                        {product.quantity == null ? 'Chưa có dữ liệu' : `${product.quantity} bó`}
                      </strong>
                    </span>
                  </div>

                  <div className="product-disclosure">
                    <span className="product-show-details">Chi tiết mẫu hoa</span>
                    <span className="product-hide-details">Thu gọn chi tiết</span>
                    <ChevronDown
                      size={14}
                      className="product-disclosure-chevron"
                      aria-hidden="true"
                    />
                  </div>
                </summary>

                {/* Expanded Actions/Editor */}
                <div className="product-expanded-actions">
                  <ProductEditor product={product} sellerId={sellerId} canEdit={canEdit} />
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}

      {filteredProducts.length > 0 && (
        <div className="product-pagination-wrapper">
          <TablePagination
            page={safePage}
            pageSize={PAGE_SIZE}
            totalItems={filteredProducts.length}
            onPageChange={setPage}
            ariaLabel="Phân trang danh sách sản phẩm"
          />
        </div>
      )}
    </div>
  );
}
