import { useEffect, useId, useRef, useState } from 'react';
import { CheckCircle2, CircleAlert, MapPin, RefreshCw, Search } from '@florabot/ui';
import KioskPickerMap from '../../kiosk-location/components/KioskPickerMap';
import {
  fetchGoongPlaceDetail,
  fetchGoongPlacePredictions,
} from '../../kiosk-location/kiosk-location.api';
import type { GoongPrediction } from '../../kiosk-location/kiosk-location.types';
import { isValidLatitude, isValidLongitude } from '../../kiosk-location/kiosk-location.utils';

const DEBOUNCE_MS = 300;
const MIN_SEARCH_CHARS = 3;

export interface KioskLocationFieldsProps {
  installationAddress: string;
  addressSelected: boolean;
  addressEditedAfterSelect: boolean;
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
  const mapId = useId();
  const mapToggleRef = useRef<HTMLButtonElement>(null);
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
  const [mapOpen, setMapOpen] = useState(false);

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
        });
    }, DEBOUNCE_MS);
  };

  const cancelPendingDetail = () => {
    detailAbortRef.current?.abort();
    detailRequestIdRef.current += 1;
    setDetailLoading(false);
    setDetailError('');
  };
  const handleInputChange = (val: string) => {
    cancelPendingDetail();
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
      <legend>Vị trí lắp đặt</legend>

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
              placeholder="Nhập số nhà, đường, phường/xã"
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
              {searchStatus !== 'loading' && (
                <button
                  type="button"
                  className="lease-address-map-link"
                  onClick={() => {
                    setIsOpen(false);
                    setActiveIndex(-1);
                    setMapOpen(true);
                    mapToggleRef.current?.focus();
                  }}
                >
                  <MapPin size={16} aria-hidden="true" /> Ghim thủ công trên bản đồ
                </button>
              )}
            </div>
          )}
        </div>

        <small id="installation-address-hint" className="kiosk-field-hint">
          Chọn địa chỉ gợi ý để ghim tự động. Nếu không thấy, nhập địa chỉ rồi chọn trên bản đồ.
        </small>

        {detailLoading && (
          <p className="kiosk-address-detail-status" role="status" aria-live="polite">
            <RefreshCw size={14} className="spin" aria-hidden="true" />
            <span>Đang xác định vị trí…</span>
          </p>
        )}

        {addressEditedAfterSelect &&
          !hasValidPin &&
          !addressError &&
          !detailError &&
          !coordinatesError && (
            <p className="kiosk-address-reselect-notice" role="status" aria-live="polite">
              Địa chỉ đã đổi. Vui lòng ghim lại vị trí.
            </p>
          )}

        {(addressError || detailError) && (
          <p id="address-error" className="kiosk-field-error" role="alert">
            {addressError || detailError}
          </p>
        )}
      </div>

      <div className="kiosk-map-picker-block">
        <div className="lease-map-controls">
          <span className="lease-pin-status" role="status">
            {hasValidPin && (
              <>
                <CheckCircle2 size={16} aria-hidden="true" /> Đã ghim vị trí
              </>
            )}
          </span>
          <button
            ref={mapToggleRef}
            type="button"
            className="button button-outline lease-map-toggle"
            aria-expanded={mapOpen}
            aria-controls={mapId}
            aria-describedby={coordinatesError ? `${mapId}-error` : undefined}
            onClick={() => setMapOpen((open) => !open)}
          >
            <MapPin size={16} aria-hidden="true" />
            {mapOpen
              ? 'Thu gọn bản đồ'
              : hasValidPin
                ? 'Kiểm tra vị trí trên bản đồ'
                : 'Chọn trên bản đồ'}
          </button>
        </div>

        {gpsMessage && (
          <p
            className={`kiosk-gps-notice ${gpsError ? 'is-error' : ''}`}
            role={gpsError ? 'alert' : 'status'}
          >
            {gpsMessage}
          </p>
        )}

        <div id={mapId} hidden={!mapOpen}>
          {mapOpen && (
            <div className="kiosk-picker-embed">
              <KioskPickerMap
                latitude={latitude}
                longitude={longitude}
                onLocationSelect={(lat, lon) => {
                  cancelPendingDetail();
                  onLocationSelect(lat, lon);
                }}
                onRequestGps={() => {
                  cancelPendingDetail();
                  onRequestGps();
                }}
                gpsLoading={gpsLoading}
                interactive={true}
                ariaLabel="Bản đồ chọn tọa độ lắp đặt kiosk"
              />
            </div>
          )}
        </div>

        {coordinatesError && (
          <p id={`${mapId}-error`} role="alert" className="kiosk-field-error">
            {coordinatesError}
          </p>
        )}
      </div>
    </fieldset>
  );
}
