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
import { fetchProductPhotos, fetchProducts, fetchSellerKiosks } from './product.api';
import type { PhotoPage, Product, SellerKiosk } from './product.types';
import { PAGE_SIZE, statusNames } from './product.types';
import { errorText, safeImage } from './product.utils';
import ProductEditor from './components/ProductEditor';
import { ProductCreateForm } from './components/ProductCatalogForm';
import './styles/products.css';

function ProductThumbnail({
  sellerId,
  productId,
  productName,
}: {
  sellerId: string;
  productId: string;
  productName: string;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const photos = useQuery<PhotoPage>({
    queryKey: ['product-photos', sellerId, productId, 1],
    queryFn: () => fetchProductPhotos(productId, 1),
    staleTime: 60_000,
  });

  const firstUrl = photos.data?.items?.[0]?.url;
  const showImage = Boolean(firstUrl && safeImage(firstUrl) && failedUrl !== firstUrl);

  return (
    <span
      className={`product-flower-icon${showImage ? 'has-thumb' : ''}`}
      aria-hidden={showImage ? undefined : 'true'}
    >
      {showImage && firstUrl ? (
        <img
          src={firstUrl}
          alt={`Ảnh ${productName}`}
          className="product-flower-thumb"
          width="48"
          height="52"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailedUrl(firstUrl)}
        />
      ) : (
        <Flower2 size={22} aria-hidden="true" />
      )}
    </span>
  );
}

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

  // Metrics for summary cards & tabs
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

      {/* Summary Stat Strip - Harmonized with .summary in seller-orders */}
      <div className="product-summary" aria-label="Thống kê mẫu hoa">
        {[
          { label: 'Tổng mẫu hoa', value: 'ALL' as const, count: totalCount, icon: Flower2 },
          { label: 'Đang kinh doanh', value: 'ACTIVE' as const, count: activeCount, icon: Store },
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
                disabled={kiosks.isPending || !kiosks.data?.length}
                aria-expanded={showCreateForm}
                aria-controls="product-create-section"
              >
                <Plus size={15} aria-hidden="true" />
                <span>Thêm bó hoa mới</span>
              </Button>
            )}
          </div>
        </div>

        {/* Status Tabs - identical underline style to seller-orders */}
        <div className="product-tabs" aria-label="Bộ lọc trạng thái mẫu hoa">
          {[
            { label: 'Tất cả', value: 'ALL' as const, count: totalCount },
            { label: 'Đang bán', value: 'ACTIVE' as const, count: activeCount },
            { label: 'Bản nháp', value: 'DRAFT' as const, count: draftCount },
            { label: 'Tạm ngừng', value: 'INACTIVE' as const, count: inactiveCount },
          ].map(({ label, value, count }) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              onClick={() => {
                setFilter(value);
                setPage(1);
              }}
            >
              {label}
              {query.isSuccess && <span>{count}</span>}
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
          className="product-form-modal"
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
          <CircleAlert size={16} aria-hidden="true" />
          <p>Chưa tải được kiosk của shop nên chưa thể tạo sản phẩm mới.</p>
        </div>
      )}

      {!kiosks.isPending && !kiosks.isError && kiosks.data?.length === 0 && (
        <div className="product-alert warning">
          <CircleAlert size={16} aria-hidden="true" />
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
          <Flower2 size={32} className="product-empty-icon" aria-hidden="true" />
          <h3>Không tìm thấy mẫu hoa nào</h3>
          <p>
            {allProducts.length
              ? 'Thử tìm với từ khóa khác hoặc chuyển sang tab trạng thái khác.'
              : 'Shop của bạn chưa có mẫu hoa nào. Hãy bấm "Thêm bó hoa mới" để bắt đầu kinh doanh.'}
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
                      {product.inventoryKind === 'LEGACY_FRESH' ? 'Dữ liệu cũ' : 'Hoa giả cao cấp'}
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
