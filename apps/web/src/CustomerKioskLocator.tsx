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
  Search,
  X,
} from '@florabot/ui';
import CustomerKioskMap from './CustomerKioskMap';
import {
  type CustomerKioskLocationItem,
  isValidLatitude,
  isValidLongitude,
  getKioskStatusLabel,
  isKioskActive,
  buildGoogleMapsDirectionsUrl,
} from './kioskTypes';
import './kiosk.css';

export default function CustomerKioskLocator() {
  const [keyword, setKeyword] = useState('');
  const [selectedArea, setSelectedArea] = useState('ALL');
  const [selectedKioskId, setSelectedKioskId] = useState<string | null>(null);
  const [userOrigin, setUserOrigin] = useState<{ lat: number; lon: number } | null>(null);
  const [radiusKm, setRadiusKm] = useState<string>('ALL');
  const [geoStatus, setGeoStatus] = useState<'IDLE' | 'LOCATING' | 'ERROR'>('IDLE');
  const [geoMessage, setGeoMessage] = useState<string | null>(null);

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
    setRadiusKm('ALL');
    setGeoStatus('IDLE');
    setGeoMessage(null);
  };

  // Build query URL with user coordinates and radiusKm for backend calculation & sorting
  const queryParams = new URLSearchParams();
  queryParams.set('limit', '50');
  if (userOrigin) {
    queryParams.set('latitude', userOrigin.lat.toFixed(5));
    queryParams.set('longitude', userOrigin.lon.toFixed(5));
    if (radiusKm !== 'ALL') {
      queryParams.set('radiusKm', radiusKm);
    }
  }

  // Public directory fetch with credentials: 'omit' and cache: 'no-store'
  // so expired session cookies never block anonymous visitors
  const kiosksQuery = useQuery({
    queryKey: ['customer-kiosk-locations', userOrigin?.lat, userOrigin?.lon, radiusKm],
    queryFn: async () => {
      const response = await fetch(`/api/kiosk-locations?${queryParams.toString()}`, {
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
      return response.json() as Promise<CustomerKioskLocationItem[]>;
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

  const displayedItems = items.filter((kiosk) => {
    // Fixed: properly filter out kiosks without region when a specific area is selected
    if (selectedArea !== 'ALL' && (!kiosk.region || !kiosk.region.includes(selectedArea))) {
      return false;
    }
    if (!keyword.trim()) return true;
    const q = keyword.trim().toLowerCase();
    return (
      kiosk.name.toLowerCase().includes(q) ||
      kiosk.code.toLowerCase().includes(q) ||
      (kiosk.address && kiosk.address.toLowerCase().includes(q)) ||
      (kiosk.region && kiosk.region.toLowerCase().includes(q))
    );
  });

  return (
    <main id="main" className="customer-kiosk-page">
      <header className="customer-kiosk-header">
        <div className="customer-kiosk-header-content">
          <h1>Tìm kiosk nhận hoa FloraBot</h1>
          <p className="customer-kiosk-lead">
            Tra cứu các điểm đặt tủ kiosk thông minh tự phục vụ gần bạn nhất. Chọn hoa trực tuyến và
            nhận hoa nhanh chóng, tiện lợi 24/7.
          </p>
        </div>
      </header>

      {/* Standard Store Locator Split Layout (Left: Unified Search & Results Card, Right: Stationary Map) */}
      <div className="customer-kiosk-split-view">
        <aside className="customer-kiosk-sidebar-pane" aria-label="Bộ lọc và danh sách kiosk">
          <div className="customer-kiosk-unified-card">
            {/* Search and Quick Filters Header */}
            <div className="customer-unified-search-header">
              <div className="customer-search-input-wrap">
                <Search size={18} aria-hidden="true" className="customer-search-icon" />
                <input
                  type="text"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="Tìm nhanh theo tên kiosk, đường, quận hoặc khu vực..."
                  className="customer-quick-search-input"
                  aria-label="Tìm nhanh kiosk"
                />
                <div className="customer-search-actions">
                  {keyword && (
                    <button
                      type="button"
                      className="customer-search-clear-btn"
                      onClick={() => setKeyword('')}
                      aria-label="Xóa từ khóa tìm kiếm"
                      title="Xóa từ khóa"
                    >
                      <X size={16} aria-hidden="true" />
                    </button>
                  )}
                  <button
                    type="button"
                    className={`customer-btn-geolocate ${userOrigin ? 'is-active' : ''} ${geoStatus === 'LOCATING' ? 'is-locating' : ''}`}
                    onClick={userOrigin ? handleClearOrigin : handleGeolocate}
                    disabled={geoStatus === 'LOCATING'}
                    title={
                      userOrigin
                        ? 'Đang tìm gần bạn. Bấm để tắt định vị'
                        : 'Tìm các kiosk gần vị trí hiện tại của bạn'
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
                      <Navigation size={17} aria-hidden="true" />
                    )}
                  </button>
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

              {userOrigin && (
                <div
                  className="customer-geo-active-bar"
                  role="region"
                  aria-label="Bộ lọc khoảng cách"
                >
                  <span className="customer-geo-active-label">
                    <Navigation size={13} aria-hidden="true" />
                    <span>
                      Gần bạn: {userOrigin.lat.toFixed(4)}, {userOrigin.lon.toFixed(4)}
                    </span>
                  </span>
                  <label htmlFor="customer-radius-select" className="sr-only">
                    Bán kính tìm kiếm
                  </label>
                  <select
                    id="customer-radius-select"
                    value={radiusKm}
                    onChange={(e) => setRadiusKm(e.target.value)}
                    className="customer-filter-select customer-radius-select"
                    aria-label="Bán kính tìm kiếm"
                  >
                    <option value="ALL">Tất cả bán kính</option>
                    <option value="3">Trong 3 km</option>
                    <option value="5">Trong 5 km</option>
                    <option value="10">Trong 10 km</option>
                    <option value="20">Trong 20 km</option>
                    <option value="50">Trong 50 km</option>
                  </select>
                  <button
                    type="button"
                    className="customer-btn-clear"
                    onClick={handleClearOrigin}
                    title="Xóa định vị"
                    aria-label="Xóa định vị"
                  >
                    <X size={14} aria-hidden="true" />
                    <span>Bỏ vị trí</span>
                  </button>
                </div>
              )}

              {availableRegions.length > 0 && (
                <div className="customer-quick-areas" role="group" aria-label="Lọc theo khu vực">
                  <span className="customer-areas-label">Khu vực:</span>
                  <button
                    type="button"
                    className={`customer-area-pill ${selectedArea === 'ALL' ? 'is-active' : ''}`}
                    onClick={() => setSelectedArea('ALL')}
                  >
                    Tất cả ({items.length})
                  </button>
                  {availableRegions.map((region) => {
                    const count = items.filter((k) => k.region === region).length;
                    return (
                      <button
                        key={region}
                        type="button"
                        className={`customer-area-pill ${selectedArea === region ? 'is-active' : ''}`}
                        onClick={() => setSelectedArea(region)}
                      >
                        {region} ({count})
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Results Title Bar */}
            <div className="customer-results-heading-row">
              <h2 id="results-title">
                Danh sách điểm đặt kiosk {!kiosksQuery.isPending && `(${displayedItems.length})`}
              </h2>
              <Button
                variant="outline"
                onClick={() => void kiosksQuery.refetch()}
                disabled={kiosksQuery.isFetching}
                className="customer-reload-btn"
                title="Tải lại danh sách"
              >
                <RefreshCw
                  size={15}
                  aria-hidden="true"
                  className={kiosksQuery.isFetching ? 'spin' : ''}
                />
                <span>Tải lại</span>
              </Button>
            </div>

            {/* Scrollable Results List / States inside the same card */}
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
                  <MapPin size={38} aria-hidden="true" />
                  <h3>Không tìm thấy kiosk nào</h3>
                  <p>Hiện chưa có kiosk nào được kích hoạt trên hệ thống.</p>
                </div>
              )}

              {!kiosksQuery.isPending &&
                !kiosksQuery.isError &&
                items.length > 0 &&
                displayedItems.length === 0 && (
                  <div className="customer-empty-state">
                    <MapPin size={38} aria-hidden="true" />
                    <h3>Không có kiosk phù hợp</h3>
                    <p>
                      Không tìm thấy điểm đặt nào phù hợp với &quot;{keyword}&quot; hoặc khu vực đã
                      chọn.
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setKeyword('');
                        setSelectedArea('ALL');
                      }}
                    >
                      Xóa bộ lọc tìm kiếm
                    </Button>
                  </div>
                )}

              {displayedItems.length > 0 && (
                <ul className="customer-kiosk-list" aria-label="Danh sách các kiosk FloraBot">
                  {displayedItems.map((kiosk) => {
                    const isOnline = isKioskActive(kiosk.status);
                    const isMaintenance = kiosk.status === 'MAINTENANCE';
                    const isOffline = kiosk.status === 'OFFLINE';
                    const statusLabel = getKioskStatusLabel(kiosk.status);

                    const directionsUrl =
                      isValidLatitude(kiosk.latitude) && isValidLongitude(kiosk.longitude)
                        ? buildGoogleMapsDirectionsUrl(kiosk.latitude, kiosk.longitude)
                        : null;

                    return (
                      <li
                        key={kiosk.id}
                        className={`customer-kiosk-item ${selectedKioskId === kiosk.id ? 'is-selected' : ''}`}
                      >
                        <div className="customer-item-header">
                          <div className="customer-item-title-wrap">
                            <span className="customer-kiosk-code">{kiosk.code}</span>
                            <h3 className="customer-kiosk-name">{kiosk.name}</h3>
                          </div>
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

                        <div className="customer-item-body">
                          <p className="customer-item-address">
                            <MapPin size={16} aria-hidden="true" className="customer-icon-pin" />
                            <span>{kiosk.address || 'Chưa cập nhật địa chỉ cụ thể'}</span>
                          </p>

                          {kiosk.region && (
                            <p className="customer-item-region">
                              Khu vực: <span>{kiosk.region}</span>
                            </p>
                          )}

                          {kiosk.distanceKm !== null && kiosk.distanceKm !== undefined && (
                            <p className="customer-item-distance">
                              Khoảng cách:{' '}
                              <strong>~{Number(kiosk.distanceKm).toFixed(1)} km</strong>{' '}
                              <span className="distance-note">(ước tính đường chim bay)</span>
                            </p>
                          )}

                          {isMaintenance && (
                            <p className="customer-maintenance-notice" role="note">
                              Kiosk đang trong quá trình bảo trì kỹ thuật. Bạn có thể chọn kiosk lân
                              cận khác.
                            </p>
                          )}

                          {isOffline && (
                            <p className="customer-offline-notice" role="note">
                              Kiosk hiện tạm ngưng nhận hoa tại tủ. Bạn có thể chọn kiosk lân cận
                              khác.
                            </p>
                          )}
                        </div>

                        <div className="customer-item-actions">
                          {isValidLatitude(kiosk.latitude) && isValidLongitude(kiosk.longitude) && (
                            <Button
                              type="button"
                              variant="outline"
                              className="customer-btn-focus"
                              onClick={() => setSelectedKioskId(kiosk.id)}
                            >
                              <MapPin size={16} aria-hidden="true" />
                              <span>Xem trên bản đồ</span>
                            </Button>
                          )}
                          {directionsUrl ? (
                            <a
                              href={directionsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="customer-btn-directions"
                              aria-label={`Chỉ đường đến ${kiosk.name} trên Google Maps (mở tab mới)`}
                            >
                              <Navigation size={15} aria-hidden="true" />
                              <span>Chỉ đường trên Google Maps</span>
                              <ArrowUpRight size={14} aria-hidden="true" />
                            </a>
                          ) : (
                            <span className="customer-no-coords-note">
                              Chưa có tọa độ chỉ đường
                            </span>
                          )}

                          <Link href="/dat-hoa" className="customer-btn-shop">
                            Xem mẫu hoa tại shop
                          </Link>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </aside>

        {/* Right Column: Stationary Map Pane */}
        <section className="customer-kiosk-map-section" aria-labelledby="map-section-title">
          <h2 id="map-section-title" className="sr-only">
            Bản đồ điểm đặt kiosk
          </h2>
          <CustomerKioskMap
            kiosks={displayedItems}
            userOrigin={userOrigin}
            selectedKioskId={selectedKioskId}
            onSelectKiosk={(id) => setSelectedKioskId(id)}
          />
        </section>
      </div>
    </main>
  );
}
