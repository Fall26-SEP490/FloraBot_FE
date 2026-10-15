'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Button, MapPin, RefreshCw, CircleAlert, Navigation, ArrowUpRight } from '@florabot/ui';
import CustomerKioskMap from './CustomerKioskMap';
import {
  type CustomerKioskLocationItem,
  isValidLatitude,
  isValidLongitude,
  parseCoordinate,
  getKioskStatusLabel,
  isKioskActive,
  buildGoogleMapsDirectionsUrl,
} from './kioskTypes';
import './kiosk.css';

export default function CustomerKioskLocator() {
  const [manualLat, setManualLat] = useState('');
  const [manualLon, setManualLon] = useState('');
  const [radiusKm, setRadiusKm] = useState<string>(''); // '' means all
  const [geoStatus, setGeoStatus] = useState<string>('');
  const [geoBusy, setGeoBusy] = useState(false);
  const [validationError, setValidationError] = useState('');

  // Active search origin (only updated on explicit user action)
  const [activeOrigin, setActiveOrigin] = useState<{ lat: number; lon: number } | null>(null);
  const [selectedKioskId, setSelectedKioskId] = useState<string | null>(null);

  const hasValidOrigin =
    activeOrigin !== null &&
    isValidLatitude(activeOrigin.lat) &&
    isValidLongitude(activeOrigin.lon);

  // Build query string strictly per API-CONTRACT.md:
  // - latitude & longitude must be paired
  // - radiusKm can ONLY be emitted when latitude and longitude are provided
  const queryParams = new URLSearchParams();
  if (hasValidOrigin) {
    queryParams.set('latitude', String(activeOrigin.lat));
    queryParams.set('longitude', String(activeOrigin.lon));
    if (radiusKm) {
      queryParams.set('radiusKm', radiusKm);
    }
  }
  queryParams.set('limit', '50');

  const queryString = queryParams.toString();
  const endpoint = `/api/kiosk-locations${queryString ? `?${queryString}` : ''}`;

  // Public directory fetch with credentials: 'omit' and cache: 'no-store'
  // so expired session cookies never block anonymous visitors
  const kiosksQuery = useQuery({
    queryKey: ['customer-kiosk-locations', queryString],
    queryFn: async () => {
      const response = await fetch(endpoint, {
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

  const handleUseCurrentLocation = () => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setGeoStatus('Trình duyệt không hỗ trợ dịch vụ định vị. Hãy nhập tọa độ thủ công bên dưới.');
      return;
    }

    setGeoBusy(true);
    setGeoStatus('Đang xác định vị trí hiện tại của bạn…');
    setValidationError('');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoBusy(false);
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lon = Number(pos.coords.longitude.toFixed(6));
        setManualLat(String(lat));
        setManualLon(String(lon));
        setActiveOrigin({ lat, lon });
        setGeoStatus('Đã tìm thấy vị trí của bạn và sắp xếp kiosk gần nhất.');
      },
      (err) => {
        setGeoBusy(false);
        if (err.code === 1) {
          setGeoStatus(
            'Quyền truy cập vị trí đã bị từ chối. Bạn có thể nhập tọa độ thủ công bên dưới để tìm kiosk gần bạn.',
          );
        } else if (err.code === 3) {
          setGeoStatus('Quá thời gian lấy vị trí. Vui lòng thử lại hoặc nhập tọa độ thủ công.');
        } else {
          setGeoStatus(
            'Không thể xác định vị trí lúc này. Vui lòng nhập tọa độ thủ công bên dưới.',
          );
        }
      },
      { timeout: 10000, enableHighAccuracy: true },
    );
  };

  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError('');
    setGeoStatus('');

    const hasLat = manualLat.trim().length > 0;
    const hasLon = manualLon.trim().length > 0;

    if (!hasLat && !hasLon) {
      // Clear origin
      setActiveOrigin(null);
      return;
    }

    if (!hasLat || !hasLon) {
      setValidationError('Cả vĩ độ và kinh độ đều phải được cung cấp cùng nhau.');
      return;
    }

    const lat = parseCoordinate(manualLat);
    const lon = parseCoordinate(manualLon);

    if (!isValidLatitude(lat)) {
      setValidationError('Vĩ độ phải là số hợp lệ trong khoảng từ -90 đến 90.');
      return;
    }

    if (!isValidLongitude(lon)) {
      setValidationError('Kinh độ phải là số hợp lệ trong khoảng từ -180 đến 180.');
      return;
    }

    setActiveOrigin({ lat, lon });
    setGeoStatus('Đã áp dụng tọa độ tìm kiếm thủ công.');
  };

  const handleClearOrigin = () => {
    setManualLat('');
    setManualLon('');
    setActiveOrigin(null);
    setRadiusKm('');
    setGeoStatus('');
    setValidationError('');
  };

  const items = kiosksQuery.data || [];

  return (
    <main id="main" className="customer-kiosk-page">
      <header className="customer-kiosk-header">
        <div className="customer-kiosk-header-content">
          <h1>Tìm kiosk nhận hoa FloraBot</h1>
          <p className="customer-kiosk-lead">
            Tra cứu các điểm đặt tủ kiosk thông minh gần bạn nhất. Chọn hoa trực tuyến và nhận hoa
            nhanh chóng, tiện lợi theo thời gian bạn muốn.
          </p>
        </div>
      </header>

      <section className="customer-kiosk-search-card" aria-labelledby="kiosk-search-heading">
        <h2 id="kiosk-search-heading" className="sr-only">
          Bộ lọc và tìm kiếm vị trí kiosk
        </h2>

        <div className="customer-geo-top-row">
          <Button
            type="button"
            variant="default"
            onClick={handleUseCurrentLocation}
            disabled={geoBusy}
            className="customer-btn-geolocate"
          >
            <Navigation size={18} aria-hidden="true" />
            <span>{geoBusy ? 'Đang định vị…' : 'Dùng vị trí hiện tại'}</span>
          </Button>

          {hasValidOrigin && (
            <Button
              type="button"
              variant="outline"
              onClick={handleClearOrigin}
              className="customer-btn-clear"
            >
              Xem tất cả kiosk (bỏ tọa độ)
            </Button>
          )}
        </div>

        {geoStatus && (
          <p className="customer-geo-message" role="status">
            {geoStatus}
          </p>
        )}

        {validationError && (
          <p className="customer-geo-error" role="alert">
            <CircleAlert size={16} aria-hidden="true" />
            <span>{validationError}</span>
          </p>
        )}

        <form className="customer-manual-origin-form" onSubmit={handleManualSearch} noValidate>
          <div className="customer-filter-grid">
            <div className="customer-input-group">
              <label htmlFor="customer-origin-lat">Vĩ độ của bạn</label>
              <input
                id="customer-origin-lat"
                type="text"
                inputMode="decimal"
                value={manualLat}
                onChange={(e) => setManualLat(e.target.value)}
                placeholder="VD: 10.782200"
                className="customer-filter-input"
              />
            </div>

            <div className="customer-input-group">
              <label htmlFor="customer-origin-lon">Kinh độ của bạn</label>
              <input
                id="customer-origin-lon"
                type="text"
                inputMode="decimal"
                value={manualLon}
                onChange={(e) => setManualLon(e.target.value)}
                placeholder="VD: 106.695500"
                className="customer-filter-input"
              />
            </div>

            <div className="customer-input-group">
              <label htmlFor="customer-radius-select">Bán kính tìm kiếm</label>
              <select
                id="customer-radius-select"
                value={radiusKm}
                disabled={!hasValidOrigin}
                onChange={(e) => setRadiusKm(e.target.value)}
                className="customer-filter-select"
                aria-describedby={!hasValidOrigin ? 'radius-disabled-hint' : undefined}
              >
                <option value="">Tất cả bán kính</option>
                <option value="5">Trong vòng 5 km</option>
                <option value="10">Trong vòng 10 km</option>
                <option value="20">Trong vòng 20 km</option>
                <option value="50">Trong vòng 50 km</option>
              </select>
              {!hasValidOrigin && (
                <span id="radius-disabled-hint" className="customer-input-hint">
                  Chỉ áp dụng khi đã có tọa độ vị trí của bạn
                </span>
              )}
            </div>

            <div className="customer-filter-action">
              <Button type="submit" variant="default" className="customer-btn-apply">
                Tìm kiếm
              </Button>
            </div>
          </div>
        </form>

        {hasValidOrigin && (
          <p className="customer-search-context" role="note">
            Đang tìm kiếm quanh tọa độ ({activeOrigin.lat.toFixed(4)}, {activeOrigin.lon.toFixed(4)}
            ) — Kết quả được sắp xếp theo kiosk gần bạn nhất.
          </p>
        )}
      </section>

      {/* Main Content: Map & List */}
      <div className="customer-kiosk-layout">
        <section className="customer-kiosk-map-section" aria-labelledby="map-section-title">
          <h2 id="map-section-title" className="sr-only">
            Bản đồ điểm đặt kiosk
          </h2>
          <CustomerKioskMap
            kiosks={items}
            userOrigin={activeOrigin}
            selectedKioskId={selectedKioskId}
            onSelectKiosk={(id) => setSelectedKioskId(id)}
          />
        </section>

        <section className="customer-kiosk-results-section" aria-labelledby="results-title">
          <div className="customer-results-heading-row">
            <h2 id="results-title">
              Danh sách điểm đặt kiosk {!kiosksQuery.isPending && `(${items.length})`}
            </h2>
            <Button
              variant="outline"
              onClick={() => void kiosksQuery.refetch()}
              disabled={kiosksQuery.isFetching}
              className="customer-reload-btn"
              title="Tải lại danh sách"
            >
              <RefreshCw
                size={16}
                aria-hidden="true"
                className={kiosksQuery.isFetching ? 'spin' : ''}
              />
              <span>Tải lại</span>
            </Button>
          </div>

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
              <MapPin size={40} aria-hidden="true" />
              <h3>Không tìm thấy kiosk nào</h3>
              <p>
                {hasValidOrigin || radiusKm
                  ? 'Không có kiosk nào trong phạm vi bán kính đã chọn. Bạn hãy thử mở rộng bán kính hoặc chọn khu vực khác.'
                  : 'Hiện chưa có kiosk nào được kích hoạt trên hệ thống.'}
              </p>
              {(hasValidOrigin || radiusKm) && (
                <Button
                  variant="outline"
                  onClick={() => {
                    handleClearOrigin();
                  }}
                >
                  Xóa bộ lọc để xem toàn bộ
                </Button>
              )}
            </div>
          )}

          {items.length > 0 && (
            <ul className="customer-kiosk-list" aria-label="Danh sách các kiosk FloraBot">
              {items.map((kiosk) => {
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
                          Khoảng cách: <strong>~{Number(kiosk.distanceKm).toFixed(1)} km</strong>{' '}
                          <span className="distance-note">(ước tính đường chim bay)</span>
                        </p>
                      )}

                      {isMaintenance && (
                        <p className="customer-maintenance-notice" role="note">
                          Kiosk đang trong quá trình bảo trì kỹ thuật. Bạn có thể chọn kiosk lân cận
                          khác.
                        </p>
                      )}

                      {isOffline && (
                        <p className="customer-offline-notice" role="note">
                          Kiosk hiện tạm ngưng nhận hoa tại tủ. Bạn có thể chọn kiosk lân cận khác.
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
                          <Navigation size={16} aria-hidden="true" />
                          <span>Chỉ đường trên Google Maps</span>
                          <ArrowUpRight size={14} aria-hidden="true" />
                        </a>
                      ) : (
                        <span className="customer-no-coords-note">Chưa có tọa độ chỉ đường</span>
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
        </section>
      </div>
    </main>
  );
}
