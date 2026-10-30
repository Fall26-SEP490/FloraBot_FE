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
  Search,
  Store,
  X,
} from '@florabot/ui';
import { money } from '@florabot/contracts';
import type { Session } from '@/shared/lib/api';
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
  const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'DRAFT' | 'INACTIVE'>('ALL');
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
  const allProducts = query.data ?? [];

  // Metrics
  const totalCount = allProducts.length;
  const activeCount = allProducts.filter((p) => p.status === 'ACTIVE').length;
  const draftCount = allProducts.filter((p) => p.status === 'DRAFT').length;
  const inactiveCount = allProducts.filter((p) => p.status === 'INACTIVE').length;

  const normalizedSearch = search.trim().toLocaleLowerCase('vi');
  const filteredProducts = allProducts.filter((product) => {
    const matchSearch =
      !normalizedSearch ||
      product.name.toLocaleLowerCase('vi').includes(normalizedSearch) ||
      product.tags?.some((t) => t.toLocaleLowerCase('vi').includes(normalizedSearch));
    const matchStatus = filter === 'ALL' || product.status === filter;
    return matchSearch && matchStatus;
  });

  const safePage = clampPage(page, filteredProducts.length, PAGE_SIZE);
  const pageItems = paginate(filteredProducts, safePage, PAGE_SIZE);

  return (
    <section className="products" aria-labelledby="products-title">
      <div className="product-page-header">
        <div>
          <h2 id="products-title">Danh mục mẫu hoa</h2>
          <p>
            Quản lý mẫu hoa của shop, điều chỉnh giá bán, kích thước đóng gói và cập nhật hình ảnh.
          </p>
        </div>
        <div className="product-header-actions">
          <Button
            type="button"
            className="product-create-btn"
            onClick={() => {
              setCreateNotice('');
              setShowCreateForm(true);
            }}
            disabled={!canEdit || kiosks.isPending || !kiosks.data?.length}
            aria-expanded={showCreateForm}
            aria-controls="product-create-section"
          >
            <Plus size={18} aria-hidden="true" />
            <span>Thêm bó hoa mới</span>
          </Button>
        </div>
      </div>

      {!canEdit && (
        <div className="product-alert warning" role="alert">
          <CircleAlert size={18} aria-hidden="true" />
          <p>
            Shop cần có gói đang hoạt động để chỉnh sửa hoặc tạo mới sản phẩm. Bạn hiện tại chỉ có
            quyền xem danh mục.
          </p>
        </div>
      )}

      {/* Metric Cards strip */}
      <div className="product-stats-grid" role="region" aria-label="Thống kê mẫu hoa">
        <button
          type="button"
          className={`product-stat-card ${filter === 'ALL' ? 'is-active' : ''}`}
          onClick={() => {
            setFilter('ALL');
            setPage(1);
          }}
        >
          <div className="product-stat-icon all" aria-hidden="true">
            <Flower2 size={22} />
          </div>
          <div className="product-stat-content">
            <span className="product-stat-label">Tổng mẫu hoa</span>
            <strong className="product-stat-value">{totalCount}</strong>
          </div>
        </button>

        <button
          type="button"
          className={`product-stat-card ${filter === 'ACTIVE' ? 'is-active' : ''}`}
          onClick={() => {
            setFilter('ACTIVE');
            setPage(1);
          }}
        >
          <div className="product-stat-icon active" aria-hidden="true">
            <Store size={22} />
          </div>
          <div className="product-stat-content">
            <span className="product-stat-label">Đang kinh doanh</span>
            <strong className="product-stat-value">{activeCount}</strong>
          </div>
        </button>

        <button
          type="button"
          className={`product-stat-card ${filter === 'DRAFT' ? 'is-active' : ''}`}
          onClick={() => {
            setFilter('DRAFT');
            setPage(1);
          }}
        >
          <div className="product-stat-icon draft" aria-hidden="true">
            <Boxes size={22} />
          </div>
          <div className="product-stat-content">
            <span className="product-stat-label">Bản nháp</span>
            <strong className="product-stat-value">{draftCount}</strong>
          </div>
        </button>

        <button
          type="button"
          className={`product-stat-card ${filter === 'INACTIVE' ? 'is-active' : ''}`}
          onClick={() => {
            setFilter('INACTIVE');
            setPage(1);
          }}
        >
          <div className="product-stat-icon inactive" aria-hidden="true">
            <CircleAlert size={22} />
          </div>
          <div className="product-stat-content">
            <span className="product-stat-label">Tạm ngừng bán</span>
            <strong className="product-stat-value">{inactiveCount}</strong>
          </div>
        </button>
      </div>

      {/* Shopee-style Status Tabs */}
      <div className="product-status-tabs" role="tablist" aria-label="Bộ lọc trạng thái mẫu hoa">
        <button
          type="button"
          role="tab"
          aria-selected={filter === 'ALL'}
          className={`product-status-tab ${filter === 'ALL' ? 'is-active' : ''}`}
          onClick={() => {
            setFilter('ALL');
            setPage(1);
          }}
        >
          <span>Tất cả</span>
          <span className="product-tab-count">{totalCount}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={filter === 'ACTIVE'}
          className={`product-status-tab ${filter === 'ACTIVE' ? 'is-active' : ''}`}
          onClick={() => {
            setFilter('ACTIVE');
            setPage(1);
          }}
        >
          <span>Đang bán</span>
          <span className="product-tab-count">{activeCount}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={filter === 'DRAFT'}
          className={`product-status-tab ${filter === 'DRAFT' ? 'is-active' : ''}`}
          onClick={() => {
            setFilter('DRAFT');
            setPage(1);
          }}
        >
          <span>Bản nháp</span>
          <span className="product-tab-count">{draftCount}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={filter === 'INACTIVE'}
          className={`product-status-tab ${filter === 'INACTIVE' ? 'is-active' : ''}`}
          onClick={() => {
            setFilter('INACTIVE');
            setPage(1);
          }}
        >
          <span>Tạm ngừng</span>
          <span className="product-tab-count">{inactiveCount}</span>
        </button>
      </div>

      {/* Toolbar: Search input + refresh button */}
      <div className="product-toolbar">
        <div className="product-search-box">
          <Search size={16} className="product-search-icon" aria-hidden="true" />
          <input
            id="product-search"
            type="search"
            aria-label="Tìm tên mẫu hoa hoặc tag"
            placeholder="Tìm theo tên mẫu hoa hoặc từ khóa (#tag)..."
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
          {search && (
            <button
              type="button"
              className="product-search-clear"
              onClick={() => {
                setSearch('');
                setPage(1);
              }}
              aria-label="Xóa từ khóa tìm kiếm"
            >
              <X size={15} aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="product-toolbar-actions">
          <Button
            variant="outline"
            className="product-refresh-btn"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
            title="Tải lại danh sách mẫu hoa"
          >
            <RefreshCw
              size={15}
              aria-hidden="true"
              className={query.isFetching ? 'is-spinning' : ''}
            />
            <span>Làm mới</span>
          </Button>
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
        <div className="product-alert error" role="alert">
          <CircleAlert size={18} aria-hidden="true" />
          <p>Chưa tải được kiosk của shop nên chưa thể tạo sản phẩm mới.</p>
        </div>
      )}

      {!kiosks.isPending && !kiosks.isError && kiosks.data?.length === 0 && (
        <div className="product-alert warning">
          <CircleAlert size={18} aria-hidden="true" />
          <p>Shop cần được phân bổ ít nhất một kiosk trước khi tạo sản phẩm mới.</p>
        </div>
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

      {!query.isPending && filteredProducts.length === 0 && (
        <div className="product-empty-state" role="status">
          <Flower2 size={40} className="product-empty-icon" aria-hidden="true" />
          <h3>Không tìm thấy mẫu hoa nào</h3>
          <p>
            {allProducts.length
              ? 'Thử tìm với từ khóa khác hoặc chuyển sang tab trạng thái khác.'
              : 'Shop của bạn chưa có mẫu hoa nào. Hãy bấm "Thêm bó hoa mới" để bắt đầu kinh doanh.'}
          </p>
        </div>
      )}

      <ul className="product-list">
        {pageItems.map((product) => (
          <li key={product.id} className="product-list-card">
            <details
              open={expandedProductId === product.id ? true : undefined}
              onToggle={(event) => {
                if (!event.currentTarget.open && expandedProductId === product.id) {
                  setExpandedProductId(null);
                }
              }}
            >
              <summary className="product-card-summary">
                <div className="product-card-left">
                  <div className="product-card-avatar" aria-hidden="true">
                    <Flower2 size={24} />
                  </div>
                  <div className="product-card-heading">
                    <div className="product-card-title-row">
                      <strong className="product-card-name">{product.name}</strong>
                      {product.inventoryKind === 'ARTIFICIAL' && (
                        <span className="product-kind-badge">Hoa giả cao cấp</span>
                      )}
                      {product.inventoryKind === 'LEGACY_FRESH' && (
                        <span className="product-kind-badge legacy">Dữ liệu cũ</span>
                      )}
                      <span className="product-status" data-status={product.status}>
                        {statusNames[product.status] || product.status}
                      </span>
                    </div>
                    <div className="product-card-specs">
                      {product.lengthCm && product.widthCm && product.heightCm ? (
                        <span className="product-card-dim">
                          Kích thước: {product.lengthCm} × {product.widthCm} × {product.heightCm} cm
                        </span>
                      ) : (
                        <span className="product-card-dim quiet">Chưa cập nhật kích thước</span>
                      )}
                      {product.tags && product.tags.length > 0 && (
                        <span className="product-card-tags">
                          {product.tags.slice(0, 3).map((tag) => (
                            <span key={tag} className="product-tag-chip">
                              #{tag}
                            </span>
                          ))}
                          {product.tags.length > 3 && (
                            <span className="product-tag-more">+{product.tags.length - 3}</span>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="product-card-right">
                  <div className="product-card-price-block">
                    <span className="product-card-price-label">Giá niêm yết</span>
                    <strong className="product-card-price">{money(Number(product.price))}</strong>
                  </div>
                  <span className="product-card-expand-action">
                    <span className="product-card-expand-text">Chi tiết &amp; Ảnh</span>
                    <ChevronDown className="product-card-chevron" size={18} aria-hidden="true" />
                  </span>
                </div>
              </summary>
              <ProductEditor product={product} sellerId={sellerId} canEdit={canEdit} />
            </details>
          </li>
        ))}
      </ul>

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
    </section>
  );
}
