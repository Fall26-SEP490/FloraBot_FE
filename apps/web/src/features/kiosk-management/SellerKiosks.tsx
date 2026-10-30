'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button, MapPin, RefreshCw, CircleAlert, Check } from '@florabot/ui';
import { ApiError, queryClient, request, type Session } from '@/shared/lib/api';
import KioskPickerMap from '../kiosk-location/components/KioskPickerMap';
import { getGoongPlaceDetail, searchGoongPlaces } from '../kiosk-location/kiosk-location.api';
import type { GoongPrediction } from '../kiosk-location/kiosk-location.types';
import { TablePagination } from '../../shared/components/DataTable';
import { clampPage, paginate } from '../../shared/pagination';
import type { SellerKioskItem, UpdateKioskLocationPayload } from './kiosk-management.types';
import {
  parseCoordinate,
  isValidLatitude,
  isValidLongitude,
  getKioskStatusLabel,
  isKioskActive,
  buildGoogleMapsSearchUrl,
} from '../kiosk-location/kiosk-location.utils';
import './styles/kiosk-management.css';

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
  const [locationSource, setLocationSource] = useState<
    'saved' | 'suggestion' | 'map' | 'current' | 'unset'
  >(kiosk.latitude != null && kiosk.longitude != null ? 'saved' : 'unset');
  const [predictions, setPredictions] = useState<GoongPrediction[]>([]);
  const [searchActive, setSearchActive] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(0);
  const selectionRef = useRef(0);

  const canEdit = isSellerRole && kiosk.canEditLocation;

  const parsedLat = parseCoordinate(latInput);
  const parsedLon = parseCoordinate(lonInput);
  const coordsValid = isValidLatitude(parsedLat) && isValidLongitude(parsedLon);
  const hasGoongSearch = Boolean(process.env.NEXT_PUBLIC_GOONG_API_KEY?.trim());
  const suggestionListId = `kiosk-address-suggestions-${kiosk.id}`;

  useEffect(() => {
    if (!canEdit || !hasGoongSearch || !searchActive || address.trim().length < 3) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void searchGoongPlaces(address).then((items) => {
        if (cancelled) return;
        setPredictions(items);
        setActiveSuggestion(0);
        setSearchLoading(false);
      });
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [address, canEdit, hasGoongSearch, searchActive]);

  const handleAddressChange = (value: string) => {
    selectionRef.current += 1;
    setAddress(value);
    setPredictions([]);
    setSearchActive(true);
    setSearchLoading(hasGoongSearch && value.trim().length >= 3);
    setDetailLoading(false);
    if (locationSource !== 'unset') {
      setLatInput('');
      setLonInput('');
      setLocationSource('unset');
    }
    setFormError('');
    setSuccessNotice('');
  };

  const handleSelectSuggestion = async (prediction: GoongPrediction) => {
    const selection = ++selectionRef.current;
    setSearchActive(false);
    setPredictions([]);
    setSearchLoading(false);
    setDetailLoading(true);
    setFormError('');
    const detail = await getGoongPlaceDetail(prediction.place_id);
    if (selection !== selectionRef.current) return;
    setDetailLoading(false);
    const lat = detail?.geometry?.location?.lat;
    const lon = detail?.geometry?.location?.lng;
    if (!isValidLatitude(lat) || !isValidLongitude(lon)) {
      setFormError(
        'Không lấy được vị trí của địa chỉ này. Hãy chọn gợi ý khác hoặc ghim trên bản đồ.',
      );
      return;
    }
    setAddress(detail?.formatted_address || prediction.description);
    setLatInput(String(lat));
    setLonInput(String(lon));
    setLocationSource('suggestion');
    setSuccessNotice('');
  };

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
      setLocationSource('saved');
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
    selectionRef.current += 1;
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
    setPredictions([]);
    setSearchActive(false);
    setSearchLoading(false);
    setDetailLoading(false);
    setLocationSource(kiosk.latitude != null && kiosk.longitude != null ? 'saved' : 'unset');
  };

  const handleMapPin = (lat: number, lon: number) => {
    if (!canEdit) return;
    selectionRef.current += 1;
    setLatInput(lat.toFixed(6));
    setLonInput(lon.toFixed(6));
    setLocationSource('map');
    setSearchActive(false);
    setPredictions([]);
    setDetailLoading(false);
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
        selectionRef.current += 1;
        setGeoBusy(false);
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lon = Number(pos.coords.longitude.toFixed(6));
        setLatInput(String(lat));
        setLonInput(String(lon));
        setLocationSource('current');
        setSearchActive(false);
        setPredictions([]);
        setDetailLoading(false);
        setGeoStatus('Đã lấy vị trí hiện tại thành công.');
      },
      (err) => {
        setGeoBusy(false);
        if (err.code === 1) {
          setGeoStatus(
            'Bạn đã từ chối cấp quyền truy cập vị trí. Hãy chọn địa chỉ hoặc ghim trên bản đồ.',
          );
        } else if (err.code === 3) {
          setGeoStatus('Quá thời gian lấy vị trí. Vui lòng thử lại hoặc chọn trên bản đồ.');
        } else {
          setGeoStatus(
            'Không thể xác định vị trí hiện tại. Hãy chọn địa chỉ hoặc ghim trên bản đồ.',
          );
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

    // A selected place or map pin must provide both coordinates.
    if (!latInput.trim() || !lonInput.trim()) {
      setFormError('Chọn địa chỉ gợi ý hoặc ghim vị trí trên bản đồ trước khi lưu.');
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
          <div className="kiosk-meta-row">
            {kiosk.address ? (
              <p className="kiosk-meta-address">
                <MapPin size={14} aria-hidden="true" />
                <span>{kiosk.address}</span>
              </p>
            ) : (
              <p className="kiosk-meta-address kiosk-address-empty">
                <MapPin size={14} aria-hidden="true" />
                <span>Chưa cập nhật địa chỉ cụ thể</span>
              </p>
            )}
            {kiosk.region && <span className="kiosk-region-badge">Khu vực: {kiosk.region}</span>}
          </div>
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
            <div className="kiosk-field kiosk-address-search">
              <label htmlFor={`kiosk-address-${kiosk.id}`}>
                Tìm địa chỉ kiosk <span className="kiosk-required">*</span>
              </label>
              <input
                id={`kiosk-address-${kiosk.id}`}
                name="address"
                type="text"
                role="combobox"
                aria-autocomplete="list"
                aria-controls={
                  searchActive && predictions.length > 0 ? suggestionListId : undefined
                }
                aria-expanded={searchActive && predictions.length > 0}
                aria-activedescendant={
                  searchActive && predictions.length > 0
                    ? `${suggestionListId}-${activeSuggestion}`
                    : undefined
                }
                autoComplete="off"
                disabled={!canEdit || saveMutation.isPending || detailLoading}
                value={address}
                onChange={(e) => handleAddressChange(e.target.value)}
                onBlur={(event) => {
                  if (!event.currentTarget.parentElement?.contains(event.relatedTarget as Node)) {
                    setSearchActive(false);
                  }
                }}
                onKeyDown={(e) => {
                  if (!searchActive || predictions.length === 0) return;
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setActiveSuggestion((index) => (index + 1) % predictions.length);
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setActiveSuggestion(
                      (index) => (index - 1 + predictions.length) % predictions.length,
                    );
                  } else if (e.key === 'Enter') {
                    e.preventDefault();
                    void handleSelectSuggestion(predictions[activeSuggestion]);
                  } else if (e.key === 'Escape') {
                    setSearchActive(false);
                  }
                }}
                placeholder="Nhập tên đường, số nhà hoặc địa điểm…"
                required
                aria-required="true"
                className="kiosk-input"
              />
              {searchActive && address.trim().length >= 3 && hasGoongSearch && (
                <div className="kiosk-suggestion-panel">
                  {searchLoading ? (
                    <p role="status">Đang tìm địa chỉ…</p>
                  ) : predictions.length > 0 ? (
                    <div id={suggestionListId} role="listbox" aria-label="Địa chỉ gợi ý">
                      {predictions.map((prediction, index) => (
                        <button
                          key={prediction.place_id}
                          id={`${suggestionListId}-${index}`}
                          type="button"
                          role="option"
                          aria-selected={index === activeSuggestion}
                          onMouseDown={(event) => event.preventDefault()}
                          onBlur={(event) => {
                            if (
                              !event.currentTarget
                                .closest('.kiosk-address-search')
                                ?.contains(event.relatedTarget as Node)
                            ) {
                              setSearchActive(false);
                            }
                          }}
                          onClick={() => void handleSelectSuggestion(prediction)}
                        >
                          {prediction.description}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p role="status">Không tìm thấy địa chỉ. Bạn có thể chọn vị trí trên bản đồ.</p>
                  )}
                </div>
              )}
              {canEdit && !hasGoongSearch && (
                <p className="kiosk-address-hint">
                  Gợi ý địa chỉ chưa khả dụng. Hãy nhập địa chỉ và chọn ghim trên bản đồ.
                </p>
              )}
              {detailLoading && (
                <p className="kiosk-address-hint" role="status">
                  Đang lấy vị trí địa chỉ…
                </p>
              )}
            </div>

            <p className="kiosk-location-selection" role="status">
              {coordsValid
                ? locationSource === 'saved'
                  ? 'Đang hiển thị ghim đã lưu. Chọn gợi ý hoặc bấm bản đồ để cập nhật.'
                  : 'Đã chọn vị trí ghim. Kiểm tra trên bản đồ trước khi lưu.'
                : 'Chọn địa chỉ gợi ý hoặc bấm vào bản đồ để đặt ghim.'}
            </p>

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

            <div className="kiosk-coords-summary" role="region" aria-label="Tọa độ kiosk">
              <div className="kiosk-coord-item">
                <span className="kiosk-coord-label">Vĩ độ (Lat):</span>
                <span className="kiosk-coord-val">
                  {parsedLat !== null ? parsedLat.toFixed(6) : '--'}
                </span>
              </div>
              <div className="kiosk-coord-item">
                <span className="kiosk-coord-label">Kinh độ (Lon):</span>
                <span className="kiosk-coord-val">
                  {parsedLon !== null ? parsedLon.toFixed(6) : '--'}
                </span>
              </div>
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
            </div>

            <div className="kiosk-disclaimer" role="note">
              <CircleAlert size={15} aria-hidden="true" className="kiosk-disclaimer-icon" />
              <span>
                Lưu ý: Địa chỉ và ghim bản đồ phục vụ chỉ đường cho khách nhận hoa tại tủ. Việc lưu
                thông tin không cấu thành xác thực vật lý của điểm bán và không cấp quyền kích hoạt
                gói thuê ô tủ hay trạng thái trực tuyến.
              </span>
            </div>
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
                      ? 'Vị trí kiosk đã được chọn'
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
              disabled={saveMutation.isPending || detailLoading}
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
