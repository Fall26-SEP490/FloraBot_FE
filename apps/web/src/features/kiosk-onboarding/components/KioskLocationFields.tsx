import { useEffect, useId, useRef, useState } from 'react';
import { CheckCircle2, CircleAlert, MapPin, RefreshCw, Search } from '@florabot/ui';
import KioskPickerMap from '../../kiosk-location/components/KioskPickerMap';
import {
  fetchGoongPlaceDetail,
  fetchGoongPlacePredictions,
} from '../../kiosk-location/kiosk-location.api';
import type { GoongPrediction } from '../../kiosk-location/kiosk-location.types';
import { isValidLatitude, isValidLongitude } from '../../kiosk-location/kiosk-location.utils';
import type { KioskLocationSource } from '../onboarding.types';

const DEBOUNCE_MS = 300;
const MIN_SEARCH_CHARS = 3;

export interface KioskLocationFieldsProps {
  installationAddress: string;
  addressSelected: boolean;
  addressEditedAfterSelect: boolean;
  locationSource: KioskLocationSource;
  onAddressChange: (val: string) => void;
  onSuggestionSelect: (address: string, lat: number, lon: number) => void;
  addressError?: string;
  latitude: number | null;
  longitude: number | null;
  onLocationSelect: (lat: number, lon: number) => void;
  coordinatesError?: string;
  gpsLoading: boolean;
  gpsMessage: string;
  gpsError?: boolean;
  onRequestGps: () => void;
}

export function KioskLocationFields({
  installationAddress,
  addressSelected,
  addressEditedAfterSelect,
  locationSource,
  onAddressChange,
  onSuggestionSelect,
  addressError,
  latitude,
  longitude,
  onLocationSelect,
  coordinatesError,
  gpsLoading,
  gpsMessage,
  gpsError = false,
  onRequestGps,
}: KioskLocationFieldsProps) {
  const listboxId = useId();
  const comboboxWrapRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchAbortRef = useRef<AbortController | null>(null);
  const detailAbortRef = useRef<AbortController | null>(null);
  const searchRequestIdRef = useRef(0);
  const detailRequestIdRef = useRef(0);

  const [predictions, setPredictions] = useState<GoongPrediction[]>([]);
  const [searchStatus, setSearchStatus] = useState<
    'idle' | 'loading' | 'success' | 'empty' | 'error'
  >('idle');
  const [searchErrorMessage, setSearchErrorMessage] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  // Cleanup any in-flight requests and timers on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      searchAbortRef.current?.abort();
      detailAbortRef.current?.abort();
    };
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (
        comboboxWrapRef.current &&
        event.target instanceof Node &&
        !comboboxWrapRef.current.contains(event.target)
      ) {
        setIsOpen(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  const cancelPendingSearch = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    searchAbortRef.current?.abort();
    searchAbortRef.current = null;
  };

  const triggerAutocompleteSearch = (query: string) => {
    cancelPendingSearch();
    const trimmed = query.trim();

    if (trimmed.length < MIN_SEARCH_CHARS) {
      searchRequestIdRef.current += 1;
      setPredictions([]);
      setSearchStatus('idle');
      setSearchErrorMessage('');
      setIsOpen(false);
      setActiveIndex(-1);
      return;
    }

    const requestId = ++searchRequestIdRef.current;
    setSearchStatus('loading');
    setSearchErrorMessage('');
    setIsOpen(true);
    setActiveIndex(-1);

    debounceTimerRef.current = setTimeout(() => {
      const controller = new AbortController();
      searchAbortRef.current = controller;

      void fetchGoongPlacePredictions(trimmed, { signal: controller.signal })
        .then((results) => {
          if (requestId !== searchRequestIdRef.current) return;
          setPredictions(results);
          if (results.length > 0) {
            setSearchStatus('success');
            setActiveIndex(0);
          } else {
            setSearchStatus('empty');
            setActiveIndex(-1);
          }
          setIsOpen(true);
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted || requestId !== searchRequestIdRef.current) return;
          setPredictions([]);
          setSearchStatus('error');
          setSearchErrorMessage(
            err instanceof Error && err.message
              ? err.message
              : 'Không thể tải gợi ý địa chỉ từ Goong. Vui lòng thử lại.',
          );
          setActiveIndex(-1);
          setIsOpen(true);
        });
    }, DEBOUNCE_MS);
  };

  const handleInputChange = (val: string) => {
    setDetailError('');
    onAddressChange(val);
    triggerAutocompleteSearch(val);
  };

  const handleSelectPrediction = (prediction: GoongPrediction) => {
    cancelPendingSearch();
    searchRequestIdRef.current += 1;
    detailAbortRef.current?.abort();

    const controller = new AbortController();
    detailAbortRef.current = controller;
    const detailReqId = ++detailRequestIdRef.current;

    setIsOpen(false);
    setActiveIndex(-1);
    setDetailLoading(true);
    setDetailError('');

    void fetchGoongPlaceDetail(prediction.place_id, { signal: controller.signal })
      .then((detail) => {
        if (detailReqId !== detailRequestIdRef.current) return;
        setDetailLoading(false);
        const resolvedAddress =
          prediction.description?.trim() ||
          detail.formatted_address?.trim() ||
          detail.name?.trim() ||
          installationAddress.trim();
        const lat = detail.geometry.location.lat;
        const lng = detail.geometry.location.lng;
        onSuggestionSelect(resolvedAddress, lat, lng);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted || detailReqId !== detailRequestIdRef.current) return;
        setDetailLoading(false);
        setDetailError(
          err instanceof Error && err.message
            ? err.message
            : 'Không lấy được tọa độ của địa chỉ đã chọn. Vui lòng chọn lại gợi ý khác.',
        );
      });
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      if (isOpen) {
        event.preventDefault();
        setIsOpen(false);
        setActiveIndex(-1);
      }
      return;
    }

    if (event.key === 'ArrowDown') {
      if (predictions.length > 0) {
        event.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
          setActiveIndex(0);
        } else {
          setActiveIndex((prev) => (prev + 1) % predictions.length);
        }
      }
      return;
    }

    if (event.key === 'ArrowUp') {
      if (predictions.length > 0) {
        event.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
          setActiveIndex(predictions.length - 1);
        } else {
          setActiveIndex((prev) => (prev <= 0 ? predictions.length - 1 : prev - 1));
        }
      }
      return;
    }

    if (event.key === 'Enter') {
      if (isOpen && searchStatus === 'success' && predictions.length > 0) {
        event.preventDefault();
        const targetIndex = activeIndex >= 0 && activeIndex < predictions.length ? activeIndex : 0;
        const chosen = predictions[targetIndex];
        if (chosen) {
          handleSelectPrediction(chosen);
        }
      }
    }
  };

  const hasValidPin = isValidLatitude(latitude) && isValidLongitude(longitude);
  const showDropdown =
    isOpen &&
    (searchStatus === 'loading' ||
      searchStatus === 'empty' ||
      searchStatus === 'error' ||
      (searchStatus === 'success' && predictions.length > 0));
  const hasListboxOptions = showDropdown && searchStatus === 'success' && predictions.length > 0;
  const activeOptionId =
    hasListboxOptions && activeIndex >= 0 && activeIndex < predictions.length
      ? `${listboxId}-option-${activeIndex}`
      : undefined;

  const describedByIds = [
    'installation-address-hint',
    addressError || detailError ? 'address-error' : null,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <fieldset className="kiosk-form-group">
      <legend>Vị trí & Địa chỉ đề xuất đặt kiosk</legend>

      <div className="kiosk-form-field">
        <label htmlFor="installation-address-input">
          Địa chỉ lắp đặt cụ thể <span className="required-star">*</span>
        </label>

        <div ref={comboboxWrapRef} className="kiosk-address-combobox-wrap">
          <div className="kiosk-address-input-shell">
            <Search size={16} className="kiosk-address-search-icon" aria-hidden="true" />
            <input
              id="installation-address-input"
              type="text"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={hasListboxOptions}
              aria-controls={hasListboxOptions ? listboxId : undefined}
              aria-activedescendant={activeOptionId}
              autoComplete="off"
              maxLength={200}
              value={installationAddress}
              onChange={(e) => handleInputChange(e.target.value)}
              onFocus={() => {
                if (
                  !addressSelected &&
                  installationAddress.trim().length >= MIN_SEARCH_CHARS &&
                  (predictions.length > 0 || searchStatus === 'empty' || searchStatus === 'error')
                ) {
                  setIsOpen(true);
                }
              }}
              onKeyDown={handleKeyDown}
              placeholder="Nhập ít nhất 3 ký tự để tìm địa chỉ gợi ý từ Goong..."
              required
              aria-invalid={Boolean(addressError || detailError)}
              aria-describedby={describedByIds || undefined}
            />
            {(searchStatus === 'loading' || detailLoading) && (
              <RefreshCw size={16} className="kiosk-address-spinner spin" aria-hidden="true" />
            )}
          </div>

          {showDropdown && (
            <div className="kiosk-address-dropdown">
              {searchStatus === 'loading' && (
                <div className="kiosk-address-dropdown-state" role="status" aria-live="polite">
                  <RefreshCw size={15} className="spin" aria-hidden="true" />
                  <span>Đang tìm địa chỉ gợi ý...</span>
                </div>
              )}

              {searchStatus === 'empty' && (
                <div className="kiosk-address-dropdown-state" role="status" aria-live="polite">
                  <span>Không tìm thấy địa chỉ phù hợp. Vui lòng thử từ khóa chi tiết hơn.</span>
                </div>
              )}

              {searchStatus === 'error' && (
                <div
                  className="kiosk-address-dropdown-state is-error"
                  role="status"
                  aria-live="polite"
                >
                  <CircleAlert size={15} aria-hidden="true" />
                  <span>
                    {searchErrorMessage || 'Không thể tải gợi ý địa chỉ. Vui lòng thử lại.'}
                  </span>
                </div>
              )}

              {searchStatus === 'success' && predictions.length > 0 && (
                <div
                  id={listboxId}
                  role="listbox"
                  aria-label="Gợi ý địa chỉ Goong"
                  className="kiosk-address-listbox"
                >
                  {predictions.map((item, idx) => {
                    const isActive = idx === activeIndex;
                    return (
                      <div
                        key={item.place_id}
                        id={`${listboxId}-option-${idx}`}
                        role="option"
                        tabIndex={-1}
                        aria-selected={isActive}
                        className={`kiosk-address-option ${isActive ? 'is-active' : ''}`}
                        onMouseEnter={() => setActiveIndex(idx)}
                        onMouseDown={(e) => {
                          // Prevent input blur before selection completes
                          e.preventDefault();
                          handleSelectPrediction(item);
                        }}
                      >
                        <MapPin
                          size={16}
                          className="kiosk-address-option-icon"
                          aria-hidden="true"
                        />
                        <div className="kiosk-address-option-text">
                          <span className="kiosk-address-main">
                            {item.structured_formatting?.main_text || item.description}
                          </span>
                          {item.structured_formatting?.secondary_text && (
                            <span className="kiosk-address-secondary">
                              {item.structured_formatting.secondary_text}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <small id="installation-address-hint" className="kiosk-field-hint">
          Nhập từ 3 ký tự trở lên và chọn một địa chỉ gợi ý để đồng bộ ghim trên bản đồ.
        </small>

        {detailLoading && (
          <p className="kiosk-address-detail-status" role="status" aria-live="polite">
            <RefreshCw size={14} className="spin" aria-hidden="true" />
            <span>Đang lấy tọa độ chi tiết của địa điểm...</span>
          </p>
        )}

        {addressEditedAfterSelect && !addressSelected && !addressError && !detailError && (
          <p className="kiosk-address-reselect-notice" role="status" aria-live="polite">
            Bạn vừa chỉnh sửa địa chỉ. Vui lòng chọn lại một gợi ý từ danh sách để xác nhận tọa độ.
          </p>
        )}

        {(addressError || detailError) && (
          <p id="address-error" className="kiosk-field-error" role="alert">
            {addressError || detailError}
          </p>
        )}
      </div>

      <div className="kiosk-map-picker-block">
        <div className="map-picker-header">
          <div>
            <span className="map-picker-title">Ghim vị trí chính xác trên bản đồ</span>
            <small className="kiosk-field-hint">
              Chọn gợi ý địa chỉ phía trên, bấm trực tiếp vào bản đồ hoặc dùng nút định vị ở góc bản
              đồ để tinh chỉnh ghim.
            </small>
          </div>
        </div>

        <div
          className={`kiosk-location-pin-status ${addressSelected && hasValidPin ? 'is-ready' : 'is-pending'}`}
          role="status"
          aria-live="polite"
        >
          {addressSelected && hasValidPin ? (
            <>
              <CheckCircle2 size={16} aria-hidden="true" />
              <span>
                {locationSource === 'map'
                  ? 'Đã chọn địa chỉ và tinh chỉnh ghim vị trí trên bản đồ.'
                  : locationSource === 'gps'
                    ? 'Đã chọn địa chỉ và cập nhật ghim vị trí từ GPS.'
                    : 'Đã chọn địa chỉ gợi ý và cập nhật ghim vị trí trên bản đồ.'}
              </span>
            </>
          ) : hasValidPin ? (
            <>
              <MapPin size={16} aria-hidden="true" />
              <span>
                Đã cập nhật ghim vị trí trên bản đồ. Vui lòng chọn thêm một địa chỉ từ gợi ý Goong
                phía trên.
              </span>
            </>
          ) : (
            <>
              <MapPin size={16} aria-hidden="true" />
              <span>Chưa có ghim vị trí. Hãy chọn một địa chỉ gợi ý hoặc chấm trên bản đồ.</span>
            </>
          )}
        </div>

        {gpsMessage && (
          <p
            className={`kiosk-gps-notice ${gpsError ? 'is-error' : ''}`}
            role={gpsError ? 'alert' : 'status'}
          >
            {gpsMessage}
          </p>
        )}

        <div className="kiosk-picker-embed">
          <KioskPickerMap
            latitude={latitude}
            longitude={longitude}
            onLocationSelect={onLocationSelect}
            onRequestGps={onRequestGps}
            gpsLoading={gpsLoading}
            interactive={true}
            ariaLabel="Bản đồ chọn tọa độ lắp đặt kiosk"
          />
        </div>

        {coordinatesError && (
          <p role="alert" className="kiosk-field-error">
            {coordinatesError}
          </p>
        )}
      </div>
    </fieldset>
  );
}
