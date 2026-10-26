'use client';

import { useState } from 'react';
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
} from '@florabot/ui';
import CustomerKioskMap from './CustomerKioskMap';
import {
  type PublicKioskDto,
  isValidLatitude,
  isValidLongitude,
  getKioskStatusLabel,
  isKioskActive,
  buildGoogleMapsDirectionsUrl,
  normalizePublicKiosk,
} from './kioskTypes';
import { buildGoongDirectionsUrl } from './goongMaps';
import './kiosk.css';

export default function CustomerKioskLocator() {
  const [keyword, setKeyword] = useState('');
  const [selectedArea, setSelectedArea] = useState('ALL');
  const [selectedKioskId, setSelectedKioskId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'MAINTENANCE' | 'OFFLINE'>(
    'ALL',
  );
  const [userOrigin, setUserOrigin] = useState<{ lat: number; lon: number } | null>(null);
  const [geoStatus, setGeoStatus] = useState<'IDLE' | 'LOCATING' | 'ERROR'>('IDLE');
  const [geoMessage, setGeoMessage] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<'list' | 'map'>('list');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

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
    queryFn: async () => {
      const response = await fetch('/api/kiosks', {
        method: 'GET',
        credentials: 'omit',
        cache: 'no-store',
      });
      if (!response.ok) {
        const err = (await response.json().catch(() => ({}))) as {
          detail?: string;
          message?: string;
        };
        throw new Error(err.detail || err.message || 'Không thể tải danh sách kiosk.');
      }
      const payload = (await response.json()) as PublicKioskDto[];
      return payload.map(normalizePublicKiosk);
    },
    staleTime: 60_000,
  });

  const items = kiosksQuery.data || [];

  // Extract unique regions for quick area pills
  const availableRegions = Array.from(
    new Set(
      items.map((k) => k.region).filter((r): r is string => Boolean(r && r.trim().length > 0)),
    ),
  );

  // Status counts for filter chips
  const activeCount = items.filter((k) => isKioskActive(k.status)).length;
  const selectedKiosk = items.find((k) => k.id === selectedKioskId) || null;
  const selectedIsOnline = selectedKiosk ? isKioskActive(selectedKiosk.status) : false;
  const selectedIsMaintenance = selectedKiosk?.status === 'MAINTENANCE';
  const selectedIsOffline = selectedKiosk?.status === 'OFFLINE';

  const selectedDirectionsUrl =
    selectedKiosk &&
    isValidLatitude(selectedKiosk.latitude) &&
    isValidLongitude(selectedKiosk.longitude)
      ? buildGoogleMapsDirectionsUrl(selectedKiosk.latitude, selectedKiosk.longitude)
      : null;

  const selectedGoongUrl =
    selectedKiosk &&
    isValidLatitude(selectedKiosk.latitude) &&
    isValidLongitude(selectedKiosk.longitude)
      ? buildGoongDirectionsUrl(
          selectedKiosk.latitude,
          selectedKiosk.longitude,
          userOrigin?.lat,
          userOrigin?.lon,
        )
      : null;

  const displayedItems = items.filter((kiosk) => {
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

  const hasAlternativeActiveKiosk = activeCount > 0;
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
            {hasActiveFilters && (
              <div className="customer-filter-header customer-filter-reset-row">
                <button
                  type="button"
                  className="customer-btn-reset-filters"
                  onClick={handleResetFilters}
                  title="Đặt lại toàn bộ bộ lọc"
                >
                  Xóa lọc
                </button>
              </div>
            )}

            {/* Search Input Bar + Compact GPS Button */}
            <div className="customer-filter-section customer-filter-search">
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
            </div>

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

            {/* Status Filter Pills (Betahaus style horizontal pills) */}
            <div className="customer-filter-section customer-filter-status">
              <span className="customer-filter-label">Trạng thái tủ</span>
              <div className="customer-filter-chips" role="group" aria-label="Lọc theo trạng thái">
                <button
                  type="button"
                  className={`customer-chip-btn ${statusFilter === 'ALL' ? 'is-active' : ''}`}
                  onClick={() => setStatusFilter('ALL')}
                >
                  Tất cả
                </button>
                <button
                  type="button"
                  className={`customer-chip-btn ${statusFilter === 'ACTIVE' ? 'is-active' : ''}`}
                  onClick={() => setStatusFilter('ACTIVE')}
                >
                  Hoạt động
                </button>
                <button
                  type="button"
                  className={`customer-chip-btn ${statusFilter === 'MAINTENANCE' ? 'is-active' : ''}`}
                  onClick={() => setStatusFilter('MAINTENANCE')}
                >
                  Bảo trì
                </button>
                <button
                  type="button"
                  className={`customer-chip-btn ${statusFilter === 'OFFLINE' ? 'is-active' : ''}`}
                  onClick={() => setStatusFilter('OFFLINE')}
                >
                  Ngoại tuyến
                </button>
              </div>
            </div>

            {/* Region / District Filter Pills */}
            {availableRegions.length > 0 && (
              <div className="customer-filter-section customer-filter-areas">
                <span className="customer-filter-label">Khu vực / Quận</span>
                <div className="customer-quick-areas" role="group" aria-label="Lọc theo khu vực">
                  <button
                    type="button"
                    className={`customer-area-pill ${selectedArea === 'ALL' ? 'is-active' : ''}`}
                    onClick={() => setSelectedArea('ALL')}
                  >
                    Tất cả khu vực
                  </button>
                  {availableRegions.map((region) => {
                    return (
                      <button
                        key={region}
                        type="button"
                        className={`customer-area-pill ${selectedArea === region ? 'is-active' : ''}`}
                        onClick={() => setSelectedArea(region)}
                      >
                        {region}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Preserved in DOM for test compatibility */}
            <div className="customer-filter-summary">
              <span>Đang hiển thị:</span>
              <strong>{displayedItems.length} kiosk</strong>
            </div>
          </div>
        </aside>

        {/* Bottom-Left Panel: Scrollable Kiosk List & Rich Detail Pane */}
        <section
          id="customer-kiosk-results-panel"
          className={`customer-kiosk-sidebar-pane ${mobileTab === 'map' ? 'is-mobile-hidden' : ''}`}
          aria-label="Danh sách và chi tiết kiosk"
        >
          <div className="customer-kiosk-unified-card">
            {selectedKiosk ? (
              <div className="customer-detail-header-bar">
                <button
                  type="button"
                  className="customer-detail-back-btn"
                  onClick={() => setSelectedKioskId(null)}
                  title="Quay lại danh sách kiosk"
                >
                  <ArrowLeft size={15} aria-hidden="true" />
                  <span>Tất cả kiosk</span>
                </button>
                <span
                  className={`customer-status-badge ${
                    selectedIsOnline
                      ? 'status-active'
                      : selectedIsMaintenance
                        ? 'status-maintenance'
                        : 'status-offline'
                  }`}
                >
                  {getKioskStatusLabel(selectedKiosk.status)}
                </span>
              </div>
            ) : (
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
            )}

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
                  <MapPin size={36} aria-hidden="true" />
                  <h3>Không tìm thấy kiosk nào</h3>
                  <p>Hiện chưa có kiosk nào được kích hoạt trên hệ thống.</p>
                </div>
              )}

              {!kiosksQuery.isPending &&
                !kiosksQuery.isError &&
                items.length > 0 &&
                displayedItems.length === 0 && (
                  <div className="customer-empty-state">
                    <MapPin size={36} aria-hidden="true" />
                    <h3>Không có kiosk phù hợp</h3>
                    <p>
                      Không tìm thấy điểm đặt nào phù hợp với &quot;{keyword}&quot; hoặc bộ lọc đã
                      chọn.
                    </p>
                    <Button variant="outline" onClick={handleResetFilters}>
                      Xóa bộ lọc tìm kiếm
                    </Button>
                  </div>
                )}

              {/* Rich Detail Card when a kiosk is selected */}
              {selectedKiosk && (
                <div className="customer-kiosk-detail-view" aria-label="Chi tiết điểm đặt kiosk">
                  <div className="customer-detail-meta-block">
                    <span className="customer-detail-kiosk-code">{selectedKiosk.code}</span>
                    <h3 className="customer-detail-name">{selectedKiosk.name}</h3>
                    <p className="customer-detail-address">
                      <MapPin size={16} aria-hidden="true" className="customer-icon-pin" />
                      <span>{selectedKiosk.address || 'Chưa cập nhật địa chỉ'}</span>
                    </p>
                    {selectedKiosk.region && (
                      <p className="customer-detail-region">
                        Khu vực: <strong>{selectedKiosk.region}</strong>
                      </p>
                    )}
                  </div>

                  {selectedIsMaintenance ? (
                    <p className="customer-maintenance-notice" role="note">
                      Kiosk đang trong quá trình bảo trì kỹ thuật.{' '}
                      {hasAlternativeActiveKiosk
                        ? 'Bạn có thể chọn kiosk đang hoạt động khác.'
                        : 'Bạn vẫn có thể xem trước danh mục hoa trực tuyến.'}
                    </p>
                  ) : selectedIsOffline ? (
                    <p className="customer-offline-notice" role="note">
                      Kiosk hiện tạm ngưng nhận hoa tại tủ.{' '}
                      {hasAlternativeActiveKiosk
                        ? 'Bạn có thể chọn kiosk lân cận khác.'
                        : 'Vui lòng quay lại sau hoặc xem trước mẫu hoa trực tuyến.'}
                    </p>
                  ) : null}

                  <div className="customer-detail-actions">
                    <Link
                      href="/dat-hoa"
                      className={`customer-btn-shop customer-btn-primary-cta ${
                        !selectedIsOnline ? 'is-secondary-cta' : ''
                      }`}
                    >
                      <Store size={16} aria-hidden="true" />
                      <span>
                        {selectedIsOnline
                          ? 'Chọn hoa nhận tại tủ này'
                          : 'Xem danh mục hoa tham khảo'}
                      </span>
                      <ArrowRight size={15} aria-hidden="true" />
                    </Link>

                    <div className="customer-detail-dir-row">
                      {selectedDirectionsUrl && (
                        <a
                          href={selectedDirectionsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="customer-btn-directions"
                          aria-label={`Chỉ đường đến ${selectedKiosk.name} trên Google Maps`}
                        >
                          <Navigation size={14} aria-hidden="true" />
                          <span>Google Maps</span>
                          <ArrowUpRight size={13} aria-hidden="true" />
                        </a>
                      )}
                      {selectedGoongUrl && (
                        <a
                          href={selectedGoongUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="customer-btn-goong-directions"
                          aria-label={`Chỉ đường đến ${selectedKiosk.name} trên Goong Maps`}
                        >
                          <Navigation size={14} aria-hidden="true" />
                          <span>Goong Maps</span>
                          <ArrowUpRight size={13} aria-hidden="true" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Betahaus-Style Kiosk Cards List */}
              <div
                className={`customer-kiosk-list-wrap ${selectedKiosk ? 'has-active-selection' : ''}`}
              >
                {selectedKiosk && displayedItems.length > 1 && (
                  <h4 className="customer-sub-list-title">Danh sách kiosk</h4>
                )}
                {displayedItems.length > 0 && (!selectedKiosk || displayedItems.length > 1) && (
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
                          className={`customer-kiosk-item ${selectedKioskId === kiosk.id ? 'is-selected' : ''}`}
                        >
                          <div className="customer-item-card-inner">
                            <div className="customer-item-main">
                              <div className="customer-item-header">
                                <div className="customer-item-title-row">
                                  <h3 className="customer-kiosk-name">{kiosk.name}</h3>
                                </div>
                                <div className="customer-item-meta-tags">
                                  <span className="customer-kiosk-code">{kiosk.code}</span>
                                  <span
                                    className={`customer-status-badge ${
                                      isOnline
                                        ? 'status-active'
                                        : isMaintenance
                                          ? 'status-maintenance'
                                          : 'status-offline'
                                    }`}
                                  >
                                    {statusLabel}
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
                                        <MapPin size={14} aria-hidden="true" />
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
                                          <ArrowUpRight size={12} aria-hidden="true" />
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
          />

          {/* Floating Preview Card on Map */}
          {selectedKiosk && (
            <div className="customer-map-floating-card">
              <div className="customer-floating-card-body">
                <div className="customer-floating-content">
                  <div className="customer-floating-card-header">
                    <div className="customer-floating-card-title">
                      <span className="customer-kiosk-code">{selectedKiosk.code}</span>
                      <h4 className="customer-kiosk-name">{selectedKiosk.name}</h4>
                    </div>
                    <span
                      className={`customer-status-badge ${
                        selectedIsOnline
                          ? 'status-active'
                          : selectedIsMaintenance
                            ? 'status-maintenance'
                            : 'status-offline'
                      }`}
                    >
                      {getKioskStatusLabel(selectedKiosk.status)}
                    </span>
                    <button
                      type="button"
                      className="customer-floating-close-btn"
                      onClick={() => setSelectedKioskId(null)}
                      aria-label="Đóng chi tiết kiosk"
                      title="Đóng chi tiết"
                    >
                      <X size={16} aria-hidden="true" />
                    </button>
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
