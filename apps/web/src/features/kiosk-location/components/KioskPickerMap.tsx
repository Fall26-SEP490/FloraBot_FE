'use client';

import { useEffect, useRef, useState } from 'react';
import { Crosshair, RefreshCw } from '@florabot/ui';
import type { CircleMarker, Map as LeafletMap } from 'leaflet';
import type { Map as MapLibreMap, Marker as MapLibreMarker } from 'maplibre-gl';
import 'leaflet/dist/leaflet.css';
import 'maplibre-gl/dist/maplibre-gl.css';
import { getMapTileConfig, isValidLatitude, isValidLongitude } from '../kiosk-location.utils';

interface KioskPickerMapProps {
  latitude: number | null;
  longitude: number | null;
  onLocationSelect?: (lat: number, lon: number) => void;
  onRequestGps?: () => void;
  gpsLoading?: boolean;
  interactive?: boolean;
  ariaLabel?: string;
  zoom?: number;
}

export default function KioskPickerMap({
  latitude,
  longitude,
  onLocationSelect,
  onRequestGps,
  gpsLoading = false,
  interactive = true,
  ariaLabel = 'Bản đồ định vị kiosk',
  zoom,
}: KioskPickerMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<CircleMarker | null>(null);
  const goongMapRef = useRef<MapLibreMap | null>(null);
  const goongMarkerRef = useRef<MapLibreMarker | null>(null);
  const [tileError, setTileError] = useState(false);
  const tileConfig = getMapTileConfig();

  const onLocationSelectRef = useRef(onLocationSelect);
  const interactiveRef = useRef(interactive);
  const initialLatRef = useRef(latitude);
  const initialLonRef = useRef(longitude);
  const initialZoomRef = useRef(zoom);

  useEffect(() => {
    onLocationSelectRef.current = onLocationSelect;
    interactiveRef.current = interactive;
  }, [onLocationSelect, interactive]);

  useEffect(() => {
    initialLatRef.current = latitude;
    initialLonRef.current = longitude;
  }, [latitude, longitude]);

  useEffect(() => {
    let cancelled = false;
    const element = containerRef.current;
    if (!element) return;

    if (tileConfig.isGoong) {
      let resizeObserver: ResizeObserver | null = null;
      void import('maplibre-gl')
        .then((maplibregl) => {
          if (cancelled || !containerRef.current) return;
          if (typeof maplibregl.setWorkerUrl === 'function') {
            maplibregl.setWorkerUrl('/maplibre-gl-worker.mjs');
          }
          const hasCoords =
            isValidLatitude(initialLatRef.current) && isValidLongitude(initialLonRef.current);
          const lat = hasCoords ? (initialLatRef.current as number) : 10.7822;
          const lon = hasCoords ? (initialLonRef.current as number) : 106.6955;
          const map = new maplibregl.Map({
            container: containerRef.current,
            style: tileConfig.styleUrl,
            center: [lon, lat],
            zoom: initialZoomRef.current ?? (hasCoords ? 15 : 12),
            attributionControl: false,
          });
          goongMapRef.current = map;
          map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
          if (hasCoords) {
            goongMarkerRef.current = new maplibregl.Marker({ color: '#e11d48' })
              .setLngLat([lon, lat])
              .addTo(map);
          }
          map.on('click', (event) => {
            if (!interactiveRef.current || !onLocationSelectRef.current) return;
            const clickLat = Number(event.lngLat.lat.toFixed(6));
            const clickLon = Number(event.lngLat.lng.toFixed(6));
            if (!goongMarkerRef.current) {
              goongMarkerRef.current = new maplibregl.Marker({ color: '#e11d48' })
                .setLngLat([clickLon, clickLat])
                .addTo(map);
            } else {
              goongMarkerRef.current.setLngLat([clickLon, clickLat]);
            }
            onLocationSelectRef.current(clickLat, clickLon);
          });
          map.on('error', (event) => {
            const status = (event as { error?: { status?: number } }).error?.status;
            if (!cancelled && (status === 401 || status === 403 || status === 404))
              setTileError(true);
          });
          resizeObserver = new ResizeObserver(() => map.resize());
          resizeObserver.observe(element);
        })
        .catch(() => {
          if (!cancelled) setTileError(true);
        });
      return () => {
        cancelled = true;
        resizeObserver?.disconnect();
        goongMarkerRef.current?.remove();
        goongMarkerRef.current = null;
        goongMapRef.current?.remove();
        goongMapRef.current = null;
      };
    }

    if ((element as unknown as { _leaflet_id?: number })._leaflet_id) {
      return;
    }

    void import('leaflet')
      .then((L) => {
        if (cancelled || !containerRef.current) return;

        const initLat = initialLatRef.current;
        const initLon = initialLonRef.current;
        const initHasCoords = isValidLatitude(initLat) && isValidLongitude(initLon);

        const defaultLat = initHasCoords ? (initLat as number) : 10.7822;
        const defaultLon = initHasCoords ? (initLon as number) : 106.6955;
        const initialZoom = initialZoomRef.current ?? (initHasCoords ? 15 : 12);

        const map = L.map(containerRef.current, {
          attributionControl: false,
          scrollWheelZoom: false,
          zoomAnimation: false,
          fadeAnimation: false,
          markerZoomAnimation: false,
        }).setView([defaultLat, defaultLon], initialZoom);

        mapRef.current = map;

        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          // OSM requires a valid Referer; override the site's privacy header for public map tiles only.
          referrerPolicy: 'strict-origin-when-cross-origin',
          minZoom: 4,
        })
          .addTo(map)
          .on('tileerror', () => {
            if (!cancelled) setTileError(true);
          });

        if (initHasCoords) {
          markerRef.current = L.circleMarker([initLat as number, initLon as number], {
            radius: 8,
            color: '#ffffff',
            fillColor: '#e11d48',
            fillOpacity: 1,
            weight: 3,
          }).addTo(map);
        }

        map.on('click', (e) => {
          if (!interactiveRef.current || !onLocationSelectRef.current) return;
          const clickLat = Number(e.latlng.lat.toFixed(6));
          const clickLon = Number(e.latlng.lng.toFixed(6));
          if (!markerRef.current) {
            markerRef.current = L.circleMarker([clickLat, clickLon], {
              radius: 8,
              color: '#ffffff',
              fillColor: '#e11d48',
              fillOpacity: 1,
              weight: 3,
            }).addTo(map);
          } else {
            markerRef.current.setLatLng([clickLat, clickLon]);
          }
          onLocationSelectRef.current(clickLat, clickLon);
        });
      })
      .catch(() => {
        if (!cancelled) setTileError(true);
      });

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
    };
  }, [tileConfig.isGoong, tileConfig.styleUrl]);

  // Sync coords from props to map/marker
  useEffect(() => {
    if (goongMapRef.current) {
      if (isValidLatitude(latitude) && isValidLongitude(longitude)) {
        if (!goongMarkerRef.current) {
          void import('maplibre-gl').then((maplibregl) => {
            if (!goongMapRef.current || goongMarkerRef.current) return;
            goongMarkerRef.current = new maplibregl.Marker({ color: '#e11d48' })
              .setLngLat([longitude, latitude])
              .addTo(goongMapRef.current);
          });
        } else {
          goongMarkerRef.current.setLngLat([longitude, latitude]);
        }
        goongMapRef.current.easeTo({
          center: [longitude, latitude],
          zoom: Math.max(goongMapRef.current.getZoom(), 14),
        });
      } else if (goongMarkerRef.current) {
        goongMarkerRef.current.remove();
        goongMarkerRef.current = null;
      }
      return;
    }
    if (!mapRef.current) return;
    void import('leaflet').then((L) => {
      if (!mapRef.current) return;
      if (isValidLatitude(latitude) && isValidLongitude(longitude)) {
        if (!markerRef.current) {
          markerRef.current = L.circleMarker([latitude, longitude], {
            radius: 8,
            color: '#ffffff',
            fillColor: '#e11d48',
            fillOpacity: 1,
            weight: 3,
          }).addTo(mapRef.current);
        } else {
          markerRef.current.setLatLng([latitude, longitude]);
        }
        mapRef.current.setView([latitude, longitude], Math.max(mapRef.current.getZoom(), 14));
      } else if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
    });
  }, [latitude, longitude]);

  const hasValidCoords = isValidLatitude(latitude) && isValidLongitude(longitude);

  return (
    <div className="kiosk-map-wrapper">
      <div className="kiosk-map-canvas-wrap">
        <div
          ref={containerRef}
          className="kiosk-picker-map"
          role="region"
          aria-label={ariaLabel}
          data-has-pin={hasValidCoords ? 'true' : 'false'}
          data-pin-lat={hasValidCoords ? latitude.toFixed(6) : ''}
          data-pin-lon={hasValidCoords ? longitude.toFixed(6) : ''}
        />
        {onRequestGps && (
          <button
            type="button"
            className={`kiosk-map-gps-btn ${gpsLoading ? 'is-loading' : ''}`}
            onClick={onRequestGps}
            disabled={gpsLoading}
            title="Dùng vị trí hiện tại"
            aria-label={gpsLoading ? 'Đang lấy vị trí hiện tại' : 'Dùng vị trí hiện tại'}
          >
            {gpsLoading ? (
              <RefreshCw size={18} className="spin" aria-hidden="true" />
            ) : (
              <Crosshair size={18} aria-hidden="true" />
            )}
          </button>
        )}
      </div>
      <div className="kiosk-map-footer">
        <p className="kiosk-map-attribution">
          {tileConfig.isGoong ? (
            <>
              Dữ liệu bản đồ ©{' '}
              <a href="https://www.goong.io" target="_blank" rel="noopener noreferrer">
                Goong Maps
              </a>{' '}
              · MapLibre
            </>
          ) : (
            <>
              Dữ liệu bản đồ ©{' '}
              <a
                href="https://www.openstreetmap.org/copyright"
                target="_blank"
                rel="noopener noreferrer"
              >
                OpenStreetMap
              </a>{' '}
              · Leaflet
            </>
          )}
        </p>
        {interactive && (
          <span className="kiosk-map-hint">Bấm vào bản đồ để đặt hoặc chỉnh ghim vị trí.</span>
        )}
      </div>
      {tileError && (
        <p className="kiosk-map-tile-warning" role="status">
          Bản đồ chưa tải được đầy đủ hình ảnh.{' '}
          {process.env.NEXT_PUBLIC_GOONG_API_KEY?.trim()
            ? 'Bạn vẫn có thể tìm và chọn địa chỉ gợi ý.'
            : 'Vui lòng tải lại trang trước khi chọn vị trí.'}
        </p>
      )}
    </div>
  );
}
