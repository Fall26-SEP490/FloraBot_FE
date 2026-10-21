'use client';

import { useEffect, useRef, useState } from 'react';
import type { Map as LeafletMap, CircleMarker } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  type CustomerKioskLocationItem,
  isValidLatitude,
  isValidLongitude,
  getKioskStatusLabel,
  buildGoogleMapsDirectionsUrl,
} from './kioskTypes';

interface CustomerKioskMapProps {
  kiosks: CustomerKioskLocationItem[];
  userOrigin: { lat: number; lon: number } | null;
  selectedKioskId: string | null;
  onSelectKiosk?: (id: string) => void;
}

export default function CustomerKioskMap({
  kiosks,
  userOrigin,
  selectedKioskId,
  onSelectKiosk,
}: CustomerKioskMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const leafletRef = useRef<any>(null);
  const markersRef = useRef<Map<string, CircleMarker>>(new Map());
  const userMarkerRef = useRef<CircleMarker | null>(null);
  const [tileError, setTileError] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const onSelectKioskRef = useRef(onSelectKiosk);

  useEffect(() => {
    onSelectKioskRef.current = onSelectKiosk;
  }, [onSelectKiosk]);

  // Step 1: Initialize Leaflet Map once on mount
  useEffect(() => {
    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;
    const element = containerRef.current;
    if (!element) return;

    if ((element as unknown as { _leaflet_id?: number })._leaflet_id) {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      delete (element as unknown as { _leaflet_id?: number })._leaflet_id;
    }

    const markers = markersRef.current;

    void import('leaflet')
      .then((L) => {
        if (cancelled || !containerRef.current) return;
        leafletRef.current = L;

        const defaultLat = 10.7822;
        const defaultLon = 106.6955;
        const defaultZoom = 11;

        const map = L.map(containerRef.current, {
          attributionControl: false,
          scrollWheelZoom: true,
          zoomAnimation: true,
          fadeAnimation: true,
          markerZoomAnimation: true,
        }).setView([defaultLat, defaultLon], defaultZoom);

        mapRef.current = map;

        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          referrerPolicy: 'strict-origin-when-cross-origin',
          minZoom: 4,
        })
          .addTo(map)
          .on('tileerror', () => {
            if (!cancelled) setTileError(true);
          });

        setTimeout(() => {
          if (!cancelled && mapRef.current) {
            mapRef.current.invalidateSize();
          }
        }, 150);

        resizeObserver = new ResizeObserver(() => {
          if (!cancelled && mapRef.current) {
            mapRef.current.invalidateSize();
          }
        });
        resizeObserver.observe(element);

        setMapReady(true);
      })
      .catch(() => {
        if (!cancelled) setTileError(true);
      });

    return () => {
      cancelled = true;
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      leafletRef.current = null;
      markers.clear();
      userMarkerRef.current = null;
      delete (element as unknown as { _leaflet_id?: number })._leaflet_id;
      setMapReady(false);
    };
  }, []);

  // Step 2: Sync markers and bounds when kiosks or userOrigin change
  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!map || !L || !mapReady) return;

    // Remove existing markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current.clear();

    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
    }

    // Add user marker if origin available
    if (userOrigin && isValidLatitude(userOrigin.lat) && isValidLongitude(userOrigin.lon)) {
      userMarkerRef.current = L.circleMarker([userOrigin.lat, userOrigin.lon], {
        radius: 8,
        color: '#0050b3',
        fillColor: '#91d5ff',
        fillOpacity: 1,
        weight: 3,
      })
        .addTo(map)
        .bindTooltip('Vị trí tìm kiếm của bạn', { permanent: false, direction: 'top' });
    }

    // Add kiosk markers
    kiosks.forEach((kiosk) => {
      if (isValidLatitude(kiosk.latitude) && isValidLongitude(kiosk.longitude)) {
        const isOnline = kiosk.status === 'ONLINE' || kiosk.status === 'ACTIVE';
        const isMaintenance = kiosk.status === 'MAINTENANCE';
        const statusLabel = getKioskStatusLabel(kiosk.status);

        const marker = L.circleMarker([kiosk.latitude, kiosk.longitude], {
          radius: 8,
          color: isOnline ? '#174b35' : isMaintenance ? '#b25e00' : '#842323',
          fillColor: isOnline ? '#ffcf24' : isMaintenance ? '#ffd591' : '#e5aaaa',
          fillOpacity: 1,
          weight: 2,
        }).addTo(map);

        const dirUrl = buildGoogleMapsDirectionsUrl(kiosk.latitude, kiosk.longitude);

        const popupContainer = document.createElement('div');
        popupContainer.className = 'customer-kiosk-popup';
        popupContainer.style.fontFamily = 'inherit';
        popupContainer.style.fontSize = '14px';
        popupContainer.style.lineHeight = '1.4';

        const titleEl = document.createElement('div');
        titleEl.style.fontWeight = '700';
        titleEl.style.color = '#183e2b';
        titleEl.textContent = kiosk.name;
        popupContainer.appendChild(titleEl);

        const metaEl = document.createElement('div');
        metaEl.style.fontSize = '12px';
        metaEl.style.color = '#476451';
        metaEl.textContent = `Mã: ${kiosk.code} · Trạng thái: ${statusLabel}`;
        popupContainer.appendChild(metaEl);

        const addressEl = document.createElement('div');
        addressEl.style.marginTop = '4px';
        addressEl.style.fontSize = '13px';
        addressEl.textContent = kiosk.address || 'Chưa cập nhật địa chỉ';
        popupContainer.appendChild(addressEl);

        if (kiosk.distanceKm !== null && kiosk.distanceKm !== undefined) {
          const distEl = document.createElement('div');
          distEl.style.marginTop = '4px';
          distEl.textContent = `~${Number(kiosk.distanceKm).toFixed(1)} km (đường chim bay)`;
          popupContainer.appendChild(distEl);
        }

        const actionEl = document.createElement('div');
        actionEl.style.marginTop = '8px';
        const linkEl = document.createElement('a');
        linkEl.href = dirUrl;
        linkEl.target = '_blank';
        linkEl.rel = 'noopener noreferrer';
        linkEl.style.color = '#174b35';
        linkEl.style.fontWeight = '600';
        linkEl.style.textDecoration = 'underline';
        linkEl.textContent = 'Chỉ đường trên Google Maps →';
        actionEl.appendChild(linkEl);
        popupContainer.appendChild(actionEl);

        marker.bindPopup(popupContainer);

        marker.on('click', () => {
          onSelectKioskRef.current?.(kiosk.id);
        });

        markersRef.current.set(kiosk.id, marker);
      }
    });

    // Fit bounds if coordinates exist
    const validCoords: [number, number][] = [];
    if (userOrigin) validCoords.push([userOrigin.lat, userOrigin.lon]);
    kiosks.forEach((k) => {
      if (isValidLatitude(k.latitude) && isValidLongitude(k.longitude)) {
        validCoords.push([k.latitude, k.longitude]);
      }
    });

    if (validCoords.length === 1) {
      map.setView(validCoords[0], 13);
    } else if (validCoords.length > 1) {
      map.fitBounds(validCoords, { padding: [30, 30], maxZoom: 15 });
    }
  }, [kiosks, userOrigin, mapReady]);

  // Step 3: Handle selectedKioskId changes without rebuilding markers
  useEffect(() => {
    if (!mapRef.current || !selectedKioskId) return;
    const marker = markersRef.current.get(selectedKioskId);
    if (marker) {
      marker.openPopup();
      mapRef.current.setView(marker.getLatLng(), Math.max(mapRef.current.getZoom(), 14));
    }
  }, [selectedKioskId, kiosks]);

  return (
    <div className="customer-kiosk-map-container">
      <div
        ref={containerRef}
        className="customer-kiosk-map"
        role="region"
        aria-label="Bản đồ các vị trí kiosk FloraBot"
      />
      <div className="customer-map-legend">
        <span className="legend-item">
          <span className="legend-dot dot-active" aria-hidden="true" /> Tủ hoạt động
        </span>
        <span className="legend-item">
          <span className="legend-dot dot-maintenance" aria-hidden="true" /> Tủ bảo trì
        </span>
        <span className="legend-item">
          <span className="legend-dot dot-offline" aria-hidden="true" /> Tủ ngoại tuyến
        </span>
        {userOrigin && (
          <span className="legend-item">
            <span className="legend-dot dot-user" aria-hidden="true" /> Vị trí của bạn
          </span>
        )}
      </div>
      <p className="customer-map-attribution">
        Dữ liệu bản đồ ©{' '}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">
          OpenStreetMap
        </a>{' '}
        ·{' '}
        <a href="https://leafletjs.com" target="_blank" rel="noopener noreferrer">
          Leaflet
        </a>
      </p>
      {tileError && (
        <p className="kiosk-map-tile-warning" role="status">
          Bản đồ chưa tải được đầy đủ hình ảnh. Bạn vẫn có thể xem danh sách địa chỉ và bấm chỉ
          đường bên dưới.
        </p>
      )}
    </div>
  );
}
