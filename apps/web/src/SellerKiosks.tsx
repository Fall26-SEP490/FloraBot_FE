'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button, MapPin, RefreshCw, CircleAlert, Check } from '@florabot/ui';
import { ApiError, queryClient, request, type Session } from './api';
import KioskPickerMap from './KioskPickerMap';
import { TablePagination } from './dashboard/DataTable';
import { clampPage, paginate } from './dashboard/pagination';
import {
  type SellerKioskItem,
  type UpdateKioskLocationPayload,
  parseCoordinate,
  isValidLatitude,
  isValidLongitude,
  getKioskStatusLabel,
  isKioskActive,
  buildGoogleMapsSearchUrl,
} from './kioskTypes';
import './kiosk.css';

interface SellerKiosksProps {
  session: Session;
}

function KioskCard({
  kiosk,
  sellerId,
  isSellerRole,
  isActiveMap,
  onSelectMap,
}: {
  kiosk: SellerKioskItem;
  sellerId: string;
  isSellerRole: boolean;
  isActiveMap: boolean;
  onSelectMap: () => void;
}) {
  const [address, setAddress] = useState(kiosk.address || '');
  const [latInput, setLatInput] = useState(
    kiosk.latitude !== null && kiosk.latitude !== undefined ? String(kiosk.latitude) : '',
  );
  const [lonInput, setLonInput] = useState(
    kiosk.longitude !== null && kiosk.longitude !== undefined ? String(kiosk.longitude) : '',
  );

  const [formError, setFormError] = useState('');
  const [successNotice, setSuccessNotice] = useState('');
  const [geoStatus, setGeoStatus] = useState('');
  const [geoBusy, setGeoBusy] = useState(false);

  const canEdit = isSellerRole && kiosk.canEditLocation;

  const parsedLat = parseCoordinate(latInput);
  const parsedLon = parseCoordinate(lonInput);
  const coordsValid = isValidLatitude(parsedLat) && isValidLongitude(parsedLon);

  const saveMutation = useMutation({
    mutationFn: (payload: UpdateKioskLocationPayload) =>
      request<SellerKioskItem>(
        `/sellers/${sellerId}/kiosks/${kiosk.id}/location`,
        payload,
        true,
        'PUT',
      ),
    onSuccess: (updated) => {
      setSuccessNotice(`Đã lưu vị trí cho kiosk ${updated.name || updated.code} thành công.`);
      setFormError('');
      void queryClient.invalidateQueries({ queryKey: ['seller-kiosks', sellerId] });
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof ApiError
          ? err.message
          : 'Không thể lưu vị trí kiosk. Vui lòng kiểm tra kết nối và thử lại.';
      setFormError(msg);
      setSuccessNotice('');
    },
  });

  const handleReset = () => {
    setAddress(kiosk.address || '');
    setLatInput(
      kiosk.latitude !== null && kiosk.latitude !== undefined ? String(kiosk.latitude) : '',
    );
    setLonInput(
      kiosk.longitude !== null && kiosk.longitude !== undefined ? String(kiosk.longitude) : '',
    );
    setFormError('');
    setSuccessNotice('');
    setGeoStatus('');
  };

  const handleMapPin = (lat: number, lon: number) => {
    if (!canEdit) return;
    setLatInput(lat.toFixed(6));
    setLonInput(lon.toFixed(6));
    setFormError('');
    setSuccessNotice('');
  };

  const handleUseCurrentLocation = () => {
    if (!canEdit) return;
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setGeoStatus('Trình duyệt của bạn không hỗ trợ định vị.');
      return;
    }

    setGeoBusy(true);
    setGeoStatus('Đang xác định vị trí hiện tại…');
    setFormError('');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoBusy(false);
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lon = Number(pos.coords.longitude.toFixed(6));
        setLatInput(String(lat));
        setLonInput(String(lon));
        setGeoStatus('Đã lấy vị trí hiện tại thành công.');
      },
      (err) => {
        setGeoBusy(false);
        if (err.code === 1) {
          setGeoStatus('Bạn đã từ chối cấp quyền truy cập vị trí. Hãy nhập tọa độ thủ công.');
        } else if (err.code === 3) {
          setGeoStatus('Quá thời gian lấy vị trí. Vui lòng thử lại hoặc nhập thủ công.');
        } else {
          setGeoStatus('Không thể xác định vị trí hiện tại. Vui lòng nhập tọa độ thủ công.');
        }
      },
      { timeout: 10000, enableHighAccuracy: true },
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;

    setSuccessNotice('');
    setFormError('');

    const trimmedAddress = address.trim();
    if (!trimmedAddress) {
      setFormError('Vui lòng nhập địa chỉ cụ thể của kiosk.');
      return;
    }

    // Explicit numeric check without coercing blank to 0
    if (!latInput.trim() || !lonInput.trim()) {
      setFormError('Cả vĩ độ và kinh độ đều phải được cung cấp cùng nhau.');
      return;
    }

    const lat = parseCoordinate(latInput);
    if (!isValidLatitude(lat)) {
      setFormError('Vĩ độ phải là số hợp lệ trong khoảng từ -90 đến 90.');
      return;
    }

    const lon = parseCoordinate(lonInput);
    if (!isValidLongitude(lon)) {
      setFormError('Kinh độ phải là số hợp lệ trong khoảng từ -180 đến 180.');
      return;
    }

    saveMutation.mutate({
      address: trimmedAddress,
      latitude: lat,
      longitude: lon,
    });
  };

  return (
    <article
      className={`kiosk-card dashboard-card ${!kiosk.locationComplete ? 'kiosk-card-incomplete' : ''}`}
      aria-labelledby={`kiosk-title-${kiosk.id}`}
    >
      <header className="kiosk-card-header">
        <div className="kiosk-card-identity">
          <div className="kiosk-badge-row">
            <span className="kiosk-code">{kiosk.code}</span>
            <span
              className={`kiosk-status-badge ${
                isKioskActive(kiosk.status)
                  ? 'badge-active'
                  : kiosk.status === 'MAINTENANCE'
                    ? 'badge-maintenance'
                    : 'badge-offline'
              }`}
            >
              {getKioskStatusLabel(kiosk.status)}
            </span>
            <span
              className={`kiosk-location-badge ${kiosk.locationComplete ? 'badge-complete' : 'badge-incomplete'}`}
            >
              {kiosk.locationComplete ? 'Đã có vị trí' : 'Thiếu vị trí'}
            </span>
          </div>
          <h2 id={`kiosk-title-${kiosk.id}`} className="kiosk-name">
            {kiosk.name}
          </h2>
          {kiosk.region && <p className="kiosk-region">Khu vực: {kiosk.region}</p>}
        </div>
      </header>

      {!canEdit && (
        <div className="kiosk-permission-notice" role="note">
          <CircleAlert size={18} aria-hidden="true" />
          <span>
            {!isSellerRole
              ? 'Tài khoản Nhân viên shop chỉ có quyền xem thông tin, không thể chỉnh sửa vị trí kiosk.'
              : 'Tủ kiosk này dùng chung hoặc chưa được gán toàn quyền cho shop. Vị trí do hệ thống quản lý, bạn không thể chỉnh sửa.'}
          </span>
        </div>
      )}

      {successNotice && (
        <p className="kiosk-feedback-success" role="status">
          <Check size={18} aria-hidden="true" />
          <span>{successNotice}</span>
        </p>
      )}

      {formError && (
        <p className="kiosk-feedback-error" role="alert">
          <CircleAlert size={18} aria-hidden="true" />
          <span>{formError}</span>
        </p>
      )}

      <form className="kiosk-form" onSubmit={handleSubmit} noValidate>
        <div className="kiosk-form-grid">
          <div className="kiosk-form-fields">
            <div className="kiosk-field">
              <label htmlFor={`kiosk-address-${kiosk.id}`}>
                Địa chỉ cụ thể <span className="kiosk-required">*</span>
              </label>
              <input
                id={`kiosk-address-${kiosk.id}`}
                name="address"
                type="text"
                disabled={!canEdit || saveMutation.isPending}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="VD: Tầng 1, TTTM Landmark 81, 720A Điện Biên Phủ, P. 22, Bình Thạnh"
                required
                aria-required="true"
                className="kiosk-input"
              />
            </div>

            <div className="kiosk-coords-row">
              <div className="kiosk-field">
                <label htmlFor={`kiosk-lat-${kiosk.id}`}>
                  Vĩ độ (Latitude) <span className="kiosk-required">*</span>
                </label>
                <input
                  id={`kiosk-lat-${kiosk.id}`}
                  name="latitude"
                  type="text"
                  inputMode="decimal"
                  disabled={!canEdit || saveMutation.isPending}
                  value={latInput}
                  onChange={(e) => setLatInput(e.target.value)}
                  placeholder="VD: 10.782200"
                  required
                  aria-required="true"
                  className="kiosk-input"
                />
              </div>

              <div className="kiosk-field">
                <label htmlFor={`kiosk-lon-${kiosk.id}`}>
                  Kinh độ (Longitude) <span className="kiosk-required">*</span>
                </label>
                <input
                  id={`kiosk-lon-${kiosk.id}`}
                  name="longitude"
                  type="text"
                  inputMode="decimal"
                  disabled={!canEdit || saveMutation.isPending}
                  value={lonInput}
                  onChange={(e) => setLonInput(e.target.value)}
                  placeholder="VD: 106.695500"
                  required
                  aria-required="true"
                  className="kiosk-input"
                />
              </div>
            </div>

            {canEdit && (
              <div className="kiosk-geo-actions">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleUseCurrentLocation}
                  disabled={geoBusy || saveMutation.isPending}
                  className="kiosk-btn-location"
                >
                  <MapPin size={16} aria-hidden="true" />
                  <span>{geoBusy ? 'Đang định vị…' : 'Dùng vị trí hiện tại'}</span>
                </Button>
                {geoStatus && (
                  <p className="kiosk-geo-status" role="status">
                    {geoStatus}
                  </p>
                )}
              </div>
            )}

            {coordsValid && (
              <div className="kiosk-preview-link-wrap">
                <a
                  href={buildGoogleMapsSearchUrl(parsedLat, parsedLon)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="kiosk-external-link"
                >
                  Xem vị trí này trên Google Maps (mở tab mới)
                </a>
              </div>
            )}

            <p className="kiosk-disclaimer">
              Lưu ý: Địa chỉ và tọa độ phục vụ chỉ đường cho khách nhận hoa tại tủ. Việc lưu thông
              tin không cấu thành xác thực vật lý của điểm bán và không cấp quyền kích hoạt gói thuê
              ô tủ hay trạng thái trực tuyến.
            </p>
          </div>

          <div className="kiosk-map-column">
            {isActiveMap ? (
              <KioskPickerMap
                latitude={parsedLat}
                longitude={parsedLon}
                onLocationSelect={handleMapPin}
                interactive={canEdit}
                ariaLabel={`Bản đồ chọn vị trí cho ${kiosk.name}`}
              />
            ) : (
              <div className="kiosk-map-inactive">
                <div className="kiosk-map-inactive-content">
                  <MapPin size={28} aria-hidden="true" />
                  <p>
                    {coordsValid
                      ? `Tọa độ đã lưu: ${latInput}, ${lonInput}`
                      : 'Bản đồ đang tạm ẩn để tối ưu hiệu năng'}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onSelectMap}
                    className="kiosk-btn-open-map"
                  >
                    <span>Mở bản đồ tủ này</span>
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {canEdit && (
          <footer className="kiosk-form-actions">
            <Button
              type="submit"
              variant="default"
              disabled={saveMutation.isPending}
              className="kiosk-btn-submit"
            >
              {saveMutation.isPending ? 'Đang lưu…' : 'Lưu vị trí kiosk'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleReset}
              disabled={saveMutation.isPending}
              className="kiosk-btn-reset"
            >
              Đặt lại
            </Button>
          </footer>
        )}
      </form>
    </article>
  );
}

export default function SellerKiosks({ session }: SellerKiosksProps) {
  const sellerId = session.sellerId;
  const isSellerRole = session.role === 'SELLER';
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'INCOMPLETE' | 'ACTIVE'>('ALL');
  const [selectedKioskId, setSelectedKioskId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 8;

  const kiosksQuery = useQuery({
    queryKey: ['seller-kiosks', sellerId],
    queryFn: () => request<SellerKioskItem[]>(`/sellers/${sellerId}/kiosks`),
    enabled: !!sellerId,
  });

  if (!sellerId) {
    return (
      <section className="seller-kiosks-page" aria-labelledby="kiosks-title">
        <h2 id="kiosks-title" className="sr-only">
          Vị trí kiosk
        </h2>
        <div className="kiosk-empty-state" role="note">
          <p>Tài khoản của bạn chưa liên kết với shop nào để quản lý kiosk.</p>
        </div>
      </section>
    );
  }

  const kiosks = kiosksQuery.data || [];
  const incompleteKiosks = kiosks.filter(
    (k) => !k.locationComplete || !k.address || k.latitude === null || k.longitude === null,
  );

  const filteredKiosks = kiosks.filter((k) => {
    if (
      statusFilter === 'INCOMPLETE' &&
      k.locationComplete &&
      k.address &&
      k.latitude !== null &&
      k.longitude !== null
    ) {
      return false;
    }
    if (statusFilter === 'ACTIVE' && !isKioskActive(k.status)) {
      return false;
    }
    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim().toLowerCase();
    return (
      (k.name && k.name.toLowerCase().includes(q)) ||
      (k.code && k.code.toLowerCase().includes(q)) ||
      (k.address && k.address.toLowerCase().includes(q)) ||
      (k.region && k.region.toLowerCase().includes(q))
    );
  });

  const safePage = clampPage(page, filteredKiosks.length, PAGE_SIZE);
  const pageItems = paginate(filteredKiosks, safePage, PAGE_SIZE);
  const activeKioskId = selectedKioskId || pageItems[0]?.id || null;

  return (
    <section className="seller-kiosks-page" aria-labelledby="kiosks-title">
      <h2 id="kiosks-title" className="sr-only">
        Danh sách kiosk
      </h2>

      {session.role === 'SELLER_STAFF' && (
        <div className="kiosk-role-warning" role="note">
          <CircleAlert size={18} aria-hidden="true" />
          <span>
            Bạn đang đăng nhập với vai trò <strong>Nhân viên shop</strong>. Bạn có thể xem vị trí
            kiosk nhưng chỉ <strong>Chủ shop (SELLER)</strong> mới có quyền cập nhật địa chỉ và tọa
            độ.
          </span>
        </div>
      )}

      {incompleteKiosks.length > 0 && (
        <div className="kiosk-required-banner" role="alert">
          <div className="kiosk-banner-content">
            <CircleAlert size={22} className="kiosk-banner-icon" aria-hidden="true" />
            <div>
              <h3>Yêu cầu cập nhật vị trí kiosk</h3>
              <p>
                Hiện có <strong>{incompleteKiosks.length}</strong> kiosk chưa hoàn tất thông tin vị
                trí (thiếu địa chỉ hoặc cặp tọa độ vĩ độ/kinh độ). Vui lòng cập nhật ngay để khách
                hàng có thể định vị và nhận hoa.
              </p>
            </div>
          </div>
        </div>
      )}

      {kiosks.length > 0 && (
        <div className="seller-kiosks-toolbar">
          <div className="kiosk-search-field">
            <label htmlFor="seller-kiosk-search" className="sr-only">
              Tìm kiếm kiosk
            </label>
            <input
              id="seller-kiosk-search"
              type="search"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Tìm theo tên kiosk, mã tủ, địa chỉ hoặc khu vực…"
              className="kiosk-search-input"
            />
          </div>
          <div className="kiosk-filter-group">
            <select
              id="seller-kiosk-status-filter"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as 'ALL' | 'INCOMPLETE' | 'ACTIVE');
                setPage(1);
              }}
              className="kiosk-select-filter"
              aria-label="Lọc theo trạng thái kiosk"
            >
              <option value="ALL">Tất cả kiosk ({kiosks.length})</option>
              {incompleteKiosks.length > 0 && (
                <option value="INCOMPLETE">Cần bổ sung vị trí ({incompleteKiosks.length})</option>
              )}
              <option value="ACTIVE">Đang hoạt động</option>
            </select>
            <Button
              variant="outline"
              onClick={() => void kiosksQuery.refetch()}
              disabled={kiosksQuery.isFetching}
              className="kiosk-reload-btn"
            >
              <RefreshCw
                size={16}
                aria-hidden="true"
                className={kiosksQuery.isFetching ? 'spin' : ''}
              />
              <span>{kiosksQuery.isFetching ? 'Đang tải lại…' : 'Tải lại danh sách'}</span>
            </Button>
          </div>
        </div>
      )}

      {kiosksQuery.isPending && (
        <div className="kiosk-loading-state" role="status">
          <p>Đang tải danh sách kiosk của shop…</p>
        </div>
      )}

      {kiosksQuery.isError && (
        <div className="kiosk-error-state" role="alert">
          <CircleAlert size={20} aria-hidden="true" />
          <p>
            {kiosksQuery.error instanceof ApiError
              ? kiosksQuery.error.message
              : 'Không thể tải danh sách kiosk. Vui lòng kiểm tra kết nối mạng và thử lại.'}
          </p>
          <Button
            variant="default"
            className="kiosk-reload-btn"
            onClick={() => void kiosksQuery.refetch()}
          >
            Thử lại
          </Button>
        </div>
      )}

      {!kiosksQuery.isPending && !kiosksQuery.isError && kiosks.length === 0 && (
        <div className="kiosk-empty-state">
          <MapPin size={36} aria-hidden="true" />
          <h2>Chưa có kiosk nào được phân bổ</h2>
          <p>
            Shop của bạn hiện chưa được phân bổ tủ kiosk nào. Vui lòng kiểm tra gói thuê ô tủ hoặc
            liên hệ quản trị viên hệ thống để được hỗ trợ phân bổ tủ.
          </p>
          <Button
            variant="outline"
            className="kiosk-reload-btn"
            onClick={() => void kiosksQuery.refetch()}
            disabled={kiosksQuery.isFetching}
          >
            <RefreshCw size={16} aria-hidden="true" />
            Tải lại danh sách
          </Button>
        </div>
      )}

      {!kiosksQuery.isPending &&
        !kiosksQuery.isError &&
        kiosks.length > 0 &&
        pageItems.length === 0 && (
          <div className="kiosk-empty-state" role="status">
            <p>Không tìm thấy kiosk nào khớp với bộ lọc tìm kiếm.</p>
            <Button
              variant="outline"
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('ALL');
              }}
            >
              Xóa bộ lọc
            </Button>
          </div>
        )}

      {pageItems.length > 0 && (
        <div className="kiosks-list">
          {pageItems.map((kiosk) => (
            <KioskCard
              key={kiosk.id}
              kiosk={kiosk}
              sellerId={sellerId}
              isSellerRole={isSellerRole}
              isActiveMap={kiosk.id === activeKioskId}
              onSelectMap={() => setSelectedKioskId(kiosk.id)}
            />
          ))}
        </div>
      )}

      {filteredKiosks.length > PAGE_SIZE && (
        <TablePagination
          page={safePage}
          pageSize={PAGE_SIZE}
          totalItems={filteredKiosks.length}
          onPageChange={setPage}
          ariaLabel="Phân trang danh sách kiosk"
        />
      )}
    </section>
  );
}
