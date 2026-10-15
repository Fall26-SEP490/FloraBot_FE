'use client';

import { useEffect, useRef, useState } from 'react';
import type { CircleMarker, Map as LeafletMap } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { isValidLatitude, isValidLongitude } from './kioskTypes';

interface KioskPickerMapProps {
  latitude: number | null;
  longitude: number | null;
  onLocationSelect?: (lat: number, lon: number) => void;
  interactive?: boolean;
  ariaLabel?: string;
  zoom?: number;
}

export default function KioskPickerMap({
  latitude,
  longitude,
  onLocationSelect,
  interactive = true,
  ariaLabel = 'Bản đồ định vị kiosk',
  zoom,
}: KioskPickerMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<CircleMarker | null>(null);
  const [tileError, setTileError] = useState(false);

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
    let cancelled = false;
    const element = containerRef.current;
    if (!element) return;

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
          minZoom: 4,
        })
          .addTo(map)
          .on('tileerror', () => {
            if (!cancelled) setTileError(true);
          });

        if (initHasCoords) {
          markerRef.current = L.circleMarker([initLat as number, initLon as number], {
            radius: 8,
            color: '#174b35',
            fillColor: '#ffcf24',
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
              color: '#174b35',
              fillColor: '#ffcf24',
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
  }, []); // Run once on mount

  // Sync coords from props to map/marker
  useEffect(() => {
    if (!mapRef.current) return;
    void import('leaflet').then((L) => {
      if (!mapRef.current) return;
      if (isValidLatitude(latitude) && isValidLongitude(longitude)) {
        if (!markerRef.current) {
          markerRef.current = L.circleMarker([latitude, longitude], {
            radius: 8,
            color: '#174b35',
            fillColor: '#ffcf24',
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

  return (
    <div className="kiosk-map-wrapper">
      <div ref={containerRef} className="kiosk-picker-map" role="region" aria-label={ariaLabel} />
      <div className="kiosk-map-footer">
        <p className="kiosk-map-attribution">
          Dữ liệu bản đồ ©{' '}
          <a
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noopener noreferrer"
          >
            OpenStreetMap
          </a>{' '}
          ·{' '}
          <a href="https://leafletjs.com" target="_blank" rel="noopener noreferrer">
            Leaflet
          </a>
        </p>
        {interactive && (
          <span className="kiosk-map-hint">Bấm vào bản đồ để chọn tọa độ ghim vị trí.</span>
        )}
      </div>
      {tileError && (
        <p className="kiosk-map-tile-warning" role="status">
          Bản đồ chưa tải được đầy đủ ô hình ảnh. Bạn vẫn có thể nhập địa chỉ và tọa độ bằng tay.
        </p>
      )}
    </div>
  );
}
