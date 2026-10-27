'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Button,
  MapPin,
  RefreshCw,
  CircleAlert,
  Navigation,
  ArrowUpRight,
  ArrowRight,
  ArrowLeft,
  Search,
  X,
  Store,
  Crosshair,
  SlidersHorizontal,
  RotateCcw,
} from '@florabot/ui';
import CustomerKioskMap from './components/CustomerKioskMap';
import { fetchPublicKiosks } from './kiosk-location.api';
import {
  isValidLatitude,
  isValidLongitude,
  getKioskStatusLabel,
  isKioskActive,
  buildGoogleMapsDirectionsUrl,
} from './kiosk-location.utils';
import './styles/kiosk-location.css';

export default function CustomerKioskLocator() {
  const [keyword, setKeyword] = useState('');
  const [selectedArea, setSelectedArea] = useState('ALL');
  const [selectedKioskId, setSelectedKioskId] = useState<string | null>(null);
  const [selectedMarkerPos, setSelectedMarkerPos] = useState<{ x: number; y: number } | null>(null);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'MAINTENANCE' | 'OFFLINE'>(
    'ALL',
  );
  const [userOrigin, setUserOrigin] = useState<{ lat: number; lon: number } | null>(null);
  const [geoStatus, setGeoStatus] = useState<'IDLE' | 'LOCATING' | 'ERROR'>('IDLE');
  const [geoMessage, setGeoMessage] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<'list' | 'map'>('list');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const handlePositionChange = useCallback((pos: { x: number; y: number } | null) => {
    setSelectedMarkerPos((prev) => {
      if (!prev && !pos) return prev;
      if (prev && pos && prev.x === pos.x && prev.y === pos.y) return prev;
      return pos;
    });
  }, []);

  useEffect(() => {
    if (selectedKioskId) {
      const el = document.getElementById(`kiosk-item-${selectedKioskId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [selectedKioskId]);

  const handleGeolocate = () => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      setGeoStatus('ERROR');
      setGeoMessage('Trình duyệt của bạn không hỗ trợ định vị.');
      return;
    }

    setGeoStatus('LOCATING');
    setGeoMessage(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserOrigin({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        });
        setGeoStatus('IDLE');
        setGeoMessage(null);
      },
      (error) => {
        setGeoStatus('ERROR');
        if (error.code === error.PERMISSION_DENIED) {
          setGeoMessage('Quyền truy cập vị trí đã bị từ chối.');
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          setGeoMessage('Không thể xác định vị trí hiện tại của bạn.');
        } else {
          setGeoMessage('Quá thời gian lấy vị trí. Vui lòng thử lại.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
  };

  const handleClearOrigin = () => {
    setUserOrigin(null);
    setGeoStatus('IDLE');
    setGeoMessage(null);
  };

  const handleResetFilters = () => {
    setKeyword('');
    setSelectedArea('ALL');
    setStatusFilter('ALL');
    handleClearOrigin();
  };

  // Public kiosk directory. The deployed endpoint accepts no query parameters.
  const kiosksQuery = useQuery({
    queryKey: ['public-kiosks'],
    queryFn: fetchPublicKiosks,
    staleTime: 60_000,
  });

  const items = useMemo(() => kiosksQuery.data || [], [kiosksQuery.data]);

  // Extract unique regions for quick area pills
  const availableRegions = Array.from(
    new Set(
      items.map((k) => k.region).filter((r): r is string => Boolean(r && r.trim().length > 0)),
    ),
  );

  // Status counts for filter chips
  const totalCount = items.length;
  const activeCount = items.filter((k) => isKioskActive(k.status)).length;
  const maintenanceCount = items.filter((k) => k.status === 'MAINTENANCE').length;
  const offlineCount = items.filter((k) => k.status === 'OFFLINE').length;
  const selectedKiosk = items.find((k) => k.id === selectedKioskId) || null;
  const selectedIsOnline = selectedKiosk ? isKioskActive(selectedKiosk.status) : false;
  const selectedIsMaintenance = selectedKiosk?.status === 'MAINTENANCE';

  const regionCounts = availableRegions.reduce<Record<string, number>>((acc, r) => {
    acc[r] = items.filter((k) => k.region === r).length;
    return acc;
  }, {});

  const selectedDirectionsUrl =
    selectedKiosk &&
    isValidLatitude(selectedKiosk.latitude) &&
    isValidLongitude(selectedKiosk.longitude)
      ? buildGoogleMapsDirectionsUrl(selectedKiosk.latitude, selectedKiosk.longitude)
      : null;

  const displayedItems = useMemo(() => {
    return items.filter((kiosk) => {
      // Area filter
      if (selectedArea !== 'ALL' && (!kiosk.region || !kiosk.region.includes(selectedArea))) {
        return false;
      }
      // Status filter
      if (statusFilter === 'ACTIVE' && !isKioskActive(kiosk.status)) {
        return false;
      }
      if (statusFilter === 'MAINTENANCE' && kiosk.status !== 'MAINTENANCE') {
        return false;
      }
      if (statusFilter === 'OFFLINE' && kiosk.status !== 'OFFLINE') {
        return false;
      }
      // Keyword search
      if (!keyword.trim()) return true;
      const q = keyword.trim().toLowerCase();
      return (
        kiosk.name.toLowerCase().includes(q) ||
        kiosk.code.toLowerCase().includes(q) ||
        (kiosk.address && kiosk.address.toLowerCase().includes(q)) ||
        (kiosk.region && kiosk.region.toLowerCase().includes(q))
      );
    });
  }, [items, selectedArea, statusFilter, keyword]);

  const activeFilterCount =
    (statusFilter !== 'ALL' ? 1 : 0) + (selectedArea !== 'ALL' ? 1 : 0) + (userOrigin ? 1 : 0);

  const hasActiveFilters =
    Boolean(keyword.trim()) ||
    selectedArea !== 'ALL' ||
    statusFilter !== 'ALL' ||
    Boolean(userOrigin);

  return (
    <main id="main" className="customer-kiosk-page">
      <header className="customer-kiosk-header">
        <div className="customer-kiosk-header-content">
          <span className="customer-kiosk-eyebrow">
            <MapPin size={14} aria-hidden="true" />
            Mạng lưới kiosk FloraBot
          </span>
          <h1>Tìm kiosk nhận hoa FloraBot</h1>
          <p className="customer-kiosk-lead">
            Tìm điểm nhận hoa thuận tiện, xem trạng thái tủ và mở chỉ đường ngay trên bản đồ.
          </p>
        </div>
      </header>

      {/* Mobile Tab Switcher */}
      <div className="customer-kiosk-mobile-tabs" role="tablist" aria-label="Chế độ xem">
        <button
          type="button"
          role="tab"
          aria-selected={mobileTab === 'list'}
          className={`customer-tab-btn ${mobileTab === 'list' ? 'is-active' : ''}`}
          onClick={() => setMobileTab('list')}
        >
          <Store size={16} aria-hidden="true" />
          <span>Danh sách</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mobileTab === 'map'}
          className={`customer-tab-btn ${mobileTab === 'map' ? 'is-active' : ''}`}
          onClick={() => setMobileTab('map')}
        >
          <MapPin size={16} aria-hidden="true" />
          <span>Bản đồ</span>
        </button>
      </div>

      {/* Left Sidebar (Search + Filters + List) & Right Full-Height Map Split View */}
      <div
        className={`customer-kiosk-split-view ${isSidebarCollapsed ? 'is-sidebar-collapsed' : ''}`}
      >
        {/* Top-Left Panel: Compact Search & Pill Filters */}
        <aside
          id="customer-kiosk-filter-panel"
          className={`customer-kiosk-filter-panel ${mobileTab === 'map' ? 'is-mobile-hidden' : ''}`}
          aria-label="Bộ lọc tìm kiếm"
        >
          <div className="customer-filter-card">
            {/* Search Input Bar & Filter Toggle in a Row */}
            <div className="customer-search-row">
              <label htmlFor="kiosk-search-input" className="customer-filter-label sr-only">
                Tìm kiếm theo từ khóa
              </label>
              <div className="customer-search-input-wrap">
                <Search size={17} aria-hidden="true" className="customer-search-icon" />
                <input
                  id="kiosk-search-input"
                  type="text"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="Tìm tên kiosk, mã tủ hoặc địa chỉ..."
                  className="customer-quick-search-input"
                  aria-label="Tìm nhanh kiosk"
                />
                {keyword && (
                  <button
                    type="button"
                    className="customer-search-clear-btn"
                    onClick={() => setKeyword('')}
                    aria-label="Xóa từ khóa tìm kiếm"
                    title="Xóa từ khóa"
                  >
                    <X size={15} aria-hidden="true" />
                  </button>
                )}
              </div>

              <button
                type="button"
                className={`customer-filter-toggle-btn ${activeFilterCount > 0 ? 'is-filtered' : ''} ${
                  isFilterOpen ? 'is-active' : ''
                }`}
                onClick={() => setIsFilterOpen((prev) => !prev)}
                aria-expanded={isFilterOpen}
                aria-controls="customer-filter-drawer"
                title={isFilterOpen ? 'Đóng bộ lọc' : 'Mở bộ lọc kiosk'}
                aria-label={isFilterOpen ? 'Đóng bộ lọc' : 'Mở bộ lọc kiosk'}
              >
                <SlidersHorizontal size={15} aria-hidden="true" />
                <span>Bộ lọc</span>
                {activeFilterCount > 0 && (
                  <span className="customer-filter-badge">{activeFilterCount}</span>
                )}
              </button>
            </div>

            {/* Active Selected Filters Bar with X to close/remove (only when drawer is closed) */}
            {hasActiveFilters && !isFilterOpen && (
              <div
                className="customer-active-filters-bar"
                role="region"
                aria-label="Bộ lọc đang áp dụng"
              >
                <span className="customer-active-filters-title">Đang chọn:</span>
                <div className="customer-active-filters-list">
                  {statusFilter !== 'ALL' && (
                    <span className="customer-active-filter-tag">
                      <span>
                        {statusFilter === 'ACTIVE'
                          ? 'Đang hoạt động'
                          : statusFilter === 'MAINTENANCE'
                            ? 'Bảo trì'
                            : 'Ngoại tuyến'}
                      </span>
                      <button
                        type="button"
                        onClick={() => setStatusFilter('ALL')}
                        title="Bỏ lọc trạng thái"
                        aria-label="Bỏ lọc trạng thái"
                        className="customer-tag-remove-btn"
                      >
                        <X size={12} aria-hidden="true" />
                      </button>
                    </span>
                  )}
                  {selectedArea !== 'ALL' && (
                    <span className="customer-active-filter-tag">
                      <span>{selectedArea}</span>
                      <button
                        type="button"
                        onClick={() => setSelectedArea('ALL')}
                        title={`Bỏ lọc khu vực ${selectedArea}`}
                        aria-label={`Bỏ lọc khu vực ${selectedArea}`}
                        className="customer-tag-remove-btn"
                      >
                        <X size={12} aria-hidden="true" />
                      </button>
                    </span>
                  )}
                  {userOrigin && (
                    <span className="customer-active-filter-tag">
                      <Navigation size={11} aria-hidden="true" />
                      <span>Gần tôi</span>
                      <button
                        type="button"
                        onClick={handleClearOrigin}
                        title="Bỏ lọc vị trí gần tôi"
                        aria-label="Bỏ lọc vị trí gần tôi"
                        className="customer-tag-remove-btn"
                      >
                        <X size={12} aria-hidden="true" />
                      </button>
                    </span>
                  )}
                  <button
                    type="button"
                    className="customer-btn-clear-all"
                    onClick={handleResetFilters}
                    title="Xóa tất cả bộ lọc"
                  >
                    Xóa tất cả
                  </button>
                </div>
              </div>
            )}

            {geoMessage && (
              <div className="customer-geo-notice" role="alert">
                <span className="customer-geo-message">{geoMessage}</span>
                <button
                  type="button"
                  className="customer-geo-notice-close"
                  onClick={() => setGeoMessage(null)}
                  aria-label="Đóng thông báo vị trí"
                >
                  <X size={14} aria-hidden="true" />
                </button>
              </div>
            )}

            {/* Active GPS status bar */}
            {userOrigin && (
              <div
                className="customer-geo-active-bar"
                role="region"
                aria-label="Bộ lọc khoảng cách"
              >
                <span className="customer-geo-active-label">
                  <Navigation size={13} aria-hidden="true" />
                  <span>
                    Vị trí: {userOrigin.lat.toFixed(3)}, {userOrigin.lon.toFixed(3)}
                  </span>
                </span>
                <button
                  type="button"
                  className="customer-btn-clear"
                  onClick={handleClearOrigin}
                  title="Xóa định vị"
                  aria-label="Xóa định vị"
                >
                  <X size={13} aria-hidden="true" />
                  <span>Bỏ</span>
                </button>
              </div>
            )}

            {/* Expandable Filter Section matching FlowerShop layout */}
            {isFilterOpen && (
              <div id="customer-filter-drawer" className="customer-filter-drawer">
                <div className="customer-filter-drawer-header">
                  <span className="customer-filter-drawer-title">
                    <SlidersHorizontal size={13} aria-hidden="true" />
                    <span>Bộ lọc kiosk</span>
                  </span>
                  {hasActiveFilters && (
                    <button
                      type="button"
                      className="customer-btn-reset-filters"
                      onClick={handleResetFilters}
                      title="Đặt lại toàn bộ bộ lọc"
                    >
                      Xóa tất cả
                    </button>
                  )}
                </div>

                {/* Status Filter Pills */}
                <div className="customer-filter-section customer-filter-status">
                  <span className="customer-filter-label">Trạng thái tủ</span>
                  <div
                    className="customer-filter-chips"
                    role="group"
                    aria-label="Lọc theo trạng thái"
                  >
                    <button
                      type="button"
                      className={`customer-chip-btn ${statusFilter === 'ALL' ? 'is-active' : ''}`}
                      onClick={() => setStatusFilter('ALL')}
                    >
                      Tất cả <span className="customer-chip-count">({totalCount})</span>
                    </button>
                    <button
                      type="button"
                      className={`customer-chip-btn ${statusFilter === 'ACTIVE' ? 'is-active' : ''}`}
                      onClick={() =>
                        setStatusFilter((prev) => (prev === 'ACTIVE' ? 'ALL' : 'ACTIVE'))
                      }
                    >
                      Hoạt động <span className="customer-chip-count">({activeCount})</span>
                    </button>
                    <button
                      type="button"
                      className={`customer-chip-btn ${statusFilter === 'MAINTENANCE' ? 'is-active' : ''}`}
                      onClick={() =>
                        setStatusFilter((prev) => (prev === 'MAINTENANCE' ? 'ALL' : 'MAINTENANCE'))
                      }
                    >
                      Bảo trì <span className="customer-chip-count">({maintenanceCount})</span>
                    </button>
                    <button
                      type="button"
                      className={`customer-chip-btn ${statusFilter === 'OFFLINE' ? 'is-active' : ''}`}
                      onClick={() =>
                        setStatusFilter((prev) => (prev === 'OFFLINE' ? 'ALL' : 'OFFLINE'))
                      }
                    >
                      Ngoại tuyến <span className="customer-chip-count">({offlineCount})</span>
                    </button>
                  </div>
                </div>

                {/* Region / District Filter Pills */}
                {availableRegions.length > 0 && (
                  <div className="customer-filter-section customer-filter-areas">
                    <span className="customer-filter-label">Khu vực / Quận</span>
                    <div
                      className="customer-quick-areas"
                      role="group"
                      aria-label="Lọc theo khu vực"
                    >
                      <button
                        type="button"
                        className={`customer-area-pill ${selectedArea === 'ALL' ? 'is-active' : ''}`}
                        onClick={() => setSelectedArea('ALL')}
                      >
                        Tất cả khu vực <span className="customer-chip-count">({totalCount})</span>
                      </button>
                      {availableRegions.map((region) => {
                        const isSelected = selectedArea === region;
                        return (
                          <button
                            key={region}
                            type="button"
                            className={`customer-area-pill ${isSelected ? 'is-active' : ''}`}
                            onClick={() =>
                              setSelectedArea((prev) => (prev === region ? 'ALL' : region))
                            }
                          >
                            {region}{' '}
                            <span className="customer-chip-count">
                              ({regionCounts[region] || 0})
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Preserved in DOM for test compatibility */}
            <div className="customer-filter-summary">
              <span>Đang hiển thị:</span>
              <strong>{displayedItems.length} kiosk</strong>
            </div>
          </div>
        </aside>

        {/* Bottom-Left Panel: Scrollable Kiosk List */}
        <section
          id="customer-kiosk-results-panel"
          className={`customer-kiosk-sidebar-pane ${mobileTab === 'map' ? 'is-mobile-hidden' : ''}`}
          aria-label="Danh sách và chi tiết kiosk"
        >
          <div className="customer-kiosk-unified-card">
            <div className="customer-results-heading-row">
              <h2 id="results-title">Điểm nhận hoa</h2>
              <Button
                variant="outline"
                onClick={() => void kiosksQuery.refetch()}
                disabled={kiosksQuery.isFetching}
                className="customer-reload-btn"
                title="Tải lại danh sách"
                aria-label="Tải lại danh sách kiosk"
              >
                <RefreshCw
                  size={14}
                  aria-hidden="true"
                  className={kiosksQuery.isFetching ? 'spin' : ''}
                />
                <span className="sr-only">Tải lại</span>
              </Button>
            </div>

            <div className="customer-unified-results-body">
              {kiosksQuery.isPending && (
                <div className="customer-loading-state" role="status">
                  <p>Đang tìm kiếm danh sách kiosk…</p>
                </div>
              )}

              {kiosksQuery.isError && (
                <div className="customer-error-state" role="alert">
                  <CircleAlert size={22} aria-hidden="true" />
                  <div>
                    <p>
                      {kiosksQuery.error instanceof Error
                        ? kiosksQuery.error.message
                        : 'Không thể kết nối với máy chủ để lấy thông tin kiosk. Vui lòng thử lại.'}
                    </p>
                    <Button variant="default" onClick={() => void kiosksQuery.refetch()}>
                      Thử lại
                    </Button>
                  </div>
                </div>
              )}

              {!kiosksQuery.isPending && !kiosksQuery.isError && items.length === 0 && (
                <div className="customer-empty-state">
                  <div className="customer-empty-icon-wrap" aria-hidden="true">
                    <MapPin size={28} strokeWidth={1.8} />
                  </div>
                  <h3>Không tìm thấy kiosk nào</h3>
                  <p>Hiện chưa có kiosk nào được kích hoạt trên hệ thống.</p>
                </div>
              )}

              {!kiosksQuery.isPending &&
                !kiosksQuery.isError &&
                items.length > 0 &&
                displayedItems.length === 0 && (
                  <div className="customer-empty-state">
                    <div className="customer-empty-icon-wrap" aria-hidden="true">
                      <MapPin size={28} strokeWidth={1.8} />
                    </div>
                    <h3>Không có kiosk phù hợp</h3>
                    <p>
                      {keyword.trim()
                        ? `Không tìm thấy điểm đặt nào phù hợp với "${keyword.trim()}".`
                        : 'Không tìm thấy điểm nhận hoa nào phù hợp với bộ lọc đã chọn.'}
                    </p>
                    <Button
                      variant="outline"
                      className="customer-empty-reset-btn"
                      onClick={handleResetFilters}
                    >
                      <RotateCcw size={14} aria-hidden="true" />
                      <span>Đặt lại bộ lọc</span>
                    </Button>
                  </div>
                )}

              {/* Kiosk Cards List */}
              <div
                className={`customer-kiosk-list-wrap ${selectedKiosk ? 'has-active-selection' : ''}`}
              >
                {displayedItems.length > 0 && (
                  <ul className="customer-kiosk-list" aria-label="Danh sách các kiosk FloraBot">
                    {displayedItems.map((kiosk) => {
                      const isOnline = isKioskActive(kiosk.status);
                      const isMaintenance = kiosk.status === 'MAINTENANCE';
                      const isOffline = kiosk.status === 'OFFLINE';
                      const statusLabel = getKioskStatusLabel(kiosk.status);
                      const hasCoordinates =
                        isValidLatitude(kiosk.latitude) && isValidLongitude(kiosk.longitude);
                      const directionsUrl =
                        isValidLatitude(kiosk.latitude) && isValidLongitude(kiosk.longitude)
                          ? buildGoogleMapsDirectionsUrl(kiosk.latitude, kiosk.longitude)
                          : null;

                      return (
                        <li
                          key={kiosk.id}
                          id={`kiosk-item-${kiosk.id}`}
                          className={`customer-kiosk-item ${selectedKioskId === kiosk.id ? 'is-selected' : ''}`}
                        >
                          <div className="customer-item-card-inner">
                            <div className="customer-item-main">
                              <div className="customer-item-header">
                                <div className="customer-item-title-row">
                                  <h3 className="customer-kiosk-name">{kiosk.name}</h3>
                                  <span
                                    className={`customer-status-badge ${
                                      isOnline
                                        ? 'status-active'
                                        : isMaintenance
                                          ? 'status-maintenance'
                                          : 'status-offline'
                                    }`}
                                    title={statusLabel}
                                    aria-label={statusLabel}
                                  >
                                    <span className="sr-only">{statusLabel}</span>
                                  </span>
                                </div>
                              </div>

                              <div className="customer-item-body">
                                <p className="customer-item-address">
                                  <MapPin
                                    size={14}
                                    aria-hidden="true"
                                    className="customer-icon-pin"
                                  />
                                  <span>{kiosk.address || 'Chưa cập nhật địa chỉ cụ thể'}</span>
                                </p>

                                {/* Compact status notice when not online */}
                                {isMaintenance && (
                                  <p className="customer-maintenance-notice" role="note">
                                    Kiosk đang trong quá trình bảo trì kỹ thuật.
                                  </p>
                                )}

                                {isOffline && (
                                  <p className="customer-offline-notice" role="note">
                                    Kiosk hiện tạm ngưng nhận hoa tại tủ.
                                  </p>
                                )}

                                {!hasCoordinates && (
                                  <span className="customer-no-coords-note">
                                    Chưa có tọa độ trên bản đồ
                                  </span>
                                )}

                                <div className="customer-item-actions">
                                  <Link
                                    href="/dat-hoa"
                                    className={`customer-btn-shop ${!isOnline ? 'is-secondary-cta' : ''}`}
                                  >
                                    <Store size={14} aria-hidden="true" />
                                    <span>{isOnline ? 'Xem mẫu hoa' : 'Xem hoa tham khảo'}</span>
                                  </Link>

                                  {hasCoordinates && (
                                    <div className="customer-item-action-subrow">
                                      <Button
                                        type="button"
                                        variant="outline"
                                        className="customer-btn-focus"
                                        onClick={() => {
                                          setSelectedKioskId(kiosk.id);
                                          setMobileTab('map');
                                        }}
                                        title="Định vị kiosk này trên bản đồ"
                                      >
                                        <MapPin size={13} aria-hidden="true" />
                                        <span>Định vị</span>
                                      </Button>

                                      {directionsUrl && (
                                        <a
                                          href={directionsUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="customer-btn-directions"
                                          title="Mở chỉ đường trên Google Maps"
                                          aria-label={`Chỉ đường đến ${kiosk.name} trên Google Maps (mở tab mới)`}
                                        >
                                          <Navigation size={13} aria-hidden="true" />
                                          <span>Chỉ đường</span>
                                          <ArrowUpRight size={11} aria-hidden="true" />
                                        </a>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Right Full-Height Map Surface */}
        <section
          className={`customer-kiosk-map-section ${mobileTab === 'list' ? 'is-mobile-hidden' : ''}`}
          aria-labelledby="map-section-title"
        >
          {/* Floating Collapse/Expand Sidebar Toggle Button on Map Divider (Betahaus style) */}
          <button
            type="button"
            className="customer-sidebar-collapse-btn"
            onClick={() => {
              setIsSidebarCollapsed((prev) => !prev);
              window.setTimeout(() => window.dispatchEvent(new Event('resize')), 240);
            }}
            aria-controls="customer-kiosk-filter-panel customer-kiosk-results-panel"
            aria-expanded={!isSidebarCollapsed}
            aria-label={isSidebarCollapsed ? 'Mở rộng danh sách kiosk' : 'Thu gọn danh sách kiosk'}
            title={isSidebarCollapsed ? 'Mở danh sách' : 'Thu gọn danh sách'}
          >
            {isSidebarCollapsed ? (
              <ArrowRight size={14} aria-hidden="true" />
            ) : (
              <ArrowLeft size={14} aria-hidden="true" />
            )}
          </button>

          {/* Floating GPS Location Button directly on Map */}
          <div className="customer-map-gps-control">
            <button
              type="button"
              className={`customer-btn-geolocate ${userOrigin ? 'is-active' : ''} ${geoStatus === 'LOCATING' ? 'is-locating' : ''}`}
              onClick={userOrigin ? handleClearOrigin : handleGeolocate}
              disabled={geoStatus === 'LOCATING'}
              title={
                userOrigin
                  ? 'Đang tìm gần bạn. Bấm để tắt định vị'
                  : 'Định vị vị trí hiện tại của bạn trên bản đồ'
              }
              aria-label={
                userOrigin
                  ? 'Tắt định vị vị trí hiện tại'
                  : 'Tìm các kiosk gần vị trí hiện tại của bạn'
              }
            >
              {geoStatus === 'LOCATING' ? (
                <RefreshCw size={17} className="spin" aria-hidden="true" />
              ) : (
                <Crosshair size={17} aria-hidden="true" />
              )}
              <span className="sr-only">
                {geoStatus === 'LOCATING'
                  ? 'Đang định vị…'
                  : userOrigin
                    ? 'Gần tôi (Bật)'
                    : 'Gần tôi (GPS)'}
              </span>
            </button>
          </div>

          <h2 id="map-section-title" className="sr-only">
            Bản đồ điểm đặt kiosk
          </h2>
          <CustomerKioskMap
            kiosks={displayedItems}
            userOrigin={userOrigin}
            selectedKioskId={selectedKioskId}
            onSelectKiosk={(id) => setSelectedKioskId(id)}
            onSelectedPositionChange={handlePositionChange}
          />

          {/* Floating Preview Card on Map */}
          {selectedKiosk && (
            <div
              className={`customer-map-floating-card ${selectedMarkerPos ? 'is-anchored' : ''} ${
                selectedMarkerPos && selectedMarkerPos.y < 230 ? 'is-flipped' : ''
              }`}
              style={
                selectedMarkerPos
                  ? {
                      left: `${selectedMarkerPos.x}px`,
                      top:
                        selectedMarkerPos.y < 230
                          ? `${selectedMarkerPos.y + 10}px`
                          : `${selectedMarkerPos.y - 54}px`,
                    }
                  : undefined
              }
            >
              <div className="customer-floating-card-body">
                <div className="customer-floating-content">
                  <div className="customer-floating-card-header">
                    <div className="customer-floating-card-title">
                      <h4 className="customer-kiosk-name">{selectedKiosk.name}</h4>
                    </div>
                    <div className="customer-floating-header-right">
                      <span
                        className={`customer-status-badge ${
                          selectedIsOnline
                            ? 'status-active'
                            : selectedIsMaintenance
                              ? 'status-maintenance'
                              : 'status-offline'
                        }`}
                        title={getKioskStatusLabel(selectedKiosk.status)}
                        aria-label={getKioskStatusLabel(selectedKiosk.status)}
                      >
                        <span className="sr-only">{getKioskStatusLabel(selectedKiosk.status)}</span>
                      </span>
                      <button
                        type="button"
                        className="customer-floating-close-btn"
                        onClick={() => {
                          setSelectedKioskId(null);
                          setSelectedMarkerPos(null);
                        }}
                        aria-label="Đóng chi tiết kiosk"
                        title="Đóng chi tiết"
                      >
                        <X size={16} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                  <p className="customer-floating-address">
                    <MapPin size={13} aria-hidden="true" className="customer-icon-pin" />
                    <span>{selectedKiosk.address || 'Chưa cập nhật địa chỉ'}</span>
                  </p>
                  <div className="customer-floating-actions">
                    {selectedDirectionsUrl && (
                      <a
                        href={selectedDirectionsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="customer-btn-directions"
                        aria-label={`Chỉ đường đến ${selectedKiosk.name} trên Google Maps`}
                      >
                        <Navigation size={13} aria-hidden="true" />
                        <span>Chỉ đường</span>
                        <ArrowUpRight size={12} aria-hidden="true" />
                      </a>
                    )}
                    <Link
                      href="/dat-hoa"
                      className={`customer-btn-shop ${!selectedIsOnline ? 'is-secondary-cta' : ''}`}
                    >
                      {selectedIsOnline ? 'Xem mẫu hoa' : 'Xem hoa tham khảo'}
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
