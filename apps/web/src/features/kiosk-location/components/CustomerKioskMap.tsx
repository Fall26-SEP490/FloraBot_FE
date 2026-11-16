'use client';

import { useEffect, useRef, useState } from 'react';
import type {
  Map as LeafletMap,
  Marker as LeafletMarker,
  CircleMarker as LeafletCircleMarker,
} from 'leaflet';
import type { Map as MapLibreMap, Marker as MapLibreMarker } from 'maplibre-gl';
import 'leaflet/dist/leaflet.css';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { CustomerKioskLocationItem } from '../kiosk-location.types';
import {
  isValidLatitude,
  isValidLongitude,
  getKioskStatusLabel,
  getMapTileConfig,
} from '../kiosk-location.utils';

interface CustomerKioskMapProps {
  kiosks: CustomerKioskLocationItem[];
  userOrigin: { lat: number; lon: number } | null;
  selectedKioskId: string | null;
  onSelectKiosk?: (id: string) => void;
}

function getKioskMarkerStatus(status: CustomerKioskLocationItem['status']) {
  if (status === 'ONLINE' || status === 'ACTIVE') return 'active';
  if (status === 'MAINTENANCE') return 'maintenance';
  return 'offline';
}

function createKioskMarkerElement(kiosk: CustomerKioskLocationItem) {
  const marker = document.createElement('button');
  marker.type = 'button';
  marker.className = `customer-map-kiosk-marker marker-${getKioskMarkerStatus(kiosk.status)}`;
  marker.setAttribute('aria-label', `${kiosk.name}: ${getKioskStatusLabel(kiosk.status)}`);
  marker.title = `${kiosk.name} · ${getKioskStatusLabel(kiosk.status)}`;

  const pin = document.createElement('span');
  pin.className = 'customer-map-kiosk-pin';
  pin.setAttribute('aria-hidden', 'true');

  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  icon.setAttribute('viewBox', '0 0 24 30');
  icon.setAttribute('width', '32');
  icon.setAttribute('height', '40');
  const outline = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  outline.setAttribute(
    'd',
    'M12 1C6.48 1 2 5.48 2 11c0 7.5 10 18 10 18s10-10.5 10-18C22 5.48 17.52 1 12 1Z',
  );
  outline.setAttribute('fill', 'currentColor');
  outline.setAttribute('stroke', '#fff');
  outline.setAttribute('stroke-width', '1.5');
  const center = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  center.setAttribute('cx', '12');
  center.setAttribute('cy', '11');
  center.setAttribute('r', '3.5');
  center.setAttribute('fill', '#fff');
  icon.append(outline, center);
  pin.appendChild(icon);
  marker.appendChild(pin);
  marker.setAttribute('aria-pressed', 'false');

  return marker;
}

export default function CustomerKioskMap({
  kiosks,
  userOrigin,
  selectedKioskId,
  onSelectKiosk,
}: CustomerKioskMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tileConfig = getMapTileConfig();
  const isGoong = tileConfig.isGoong;

  // Refs for MapLibre (Goong) engine
  const mapLibreRef = useRef<MapLibreMap | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapLibreLibRef = useRef<any>(null);
  const mapLibreMarkersRef = useRef<Map<string, MapLibreMarker>>(new Map());
  const mapLibreUserMarkerRef = useRef<MapLibreMarker | null>(null);

  // Refs for Leaflet fallback engine
  const leafletMapRef = useRef<LeafletMap | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const leafletLibRef = useRef<any>(null);
  const leafletMarkersRef = useRef<Map<string, LeafletMarker>>(new Map());
  const leafletUserMarkerRef = useRef<LeafletCircleMarker | null>(null);

  const [tileError, setTileError] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const onSelectKioskRef = useRef(onSelectKiosk);

  useEffect(() => {
    onSelectKioskRef.current = onSelectKiosk;
  }, [onSelectKiosk]);

  // Step 1: Initialize Map engine once on mount
  useEffect(() => {
    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;
    const element = containerRef.current;
    if (!element) return;
    const mapLibreMarkers = mapLibreMarkersRef.current;

    if (isGoong) {
      // Initialize MapLibre GL for Goong Maps
      void import('maplibre-gl')
        .then((maplibregl) => {
          if (cancelled || !containerRef.current) return;
          mapLibreLibRef.current = maplibregl;

          if (typeof window !== 'undefined' && typeof maplibregl.setWorkerUrl === 'function') {
            maplibregl.setWorkerUrl('/maplibre-gl-worker.mjs');
          }

          const defaultLng = 106.6955;
          const defaultLat = 10.7822;
          const defaultZoom = 11;

          const map = new maplibregl.Map({
            container: containerRef.current,
            style: tileConfig.styleUrl,
            center: [defaultLng, defaultLat],
            zoom: defaultZoom,
            attributionControl: false,
          });

          map.addControl(
            new maplibregl.NavigationControl({ showCompass: true, visualizePitch: true }),
            'top-right',
          );

          mapLibreRef.current = map;
          setMapReady(true);

          map.on('error', (e) => {
            if (!cancelled) {
              const status = (e as { error?: { status?: number } }).error?.status;
              if (status === 401 || status === 403 || status === 404) {
                setTileError(true);
              }
            }
          });

          resizeObserver = new ResizeObserver(() => {
            if (!cancelled && mapLibreRef.current) {
              mapLibreRef.current.resize();
            }
          });
          resizeObserver.observe(element);
        })
        .catch(() => {
          if (!cancelled) setTileError(true);
        });

      return () => {
        cancelled = true;
        if (resizeObserver) resizeObserver.disconnect();
        if (mapLibreRef.current) {
          mapLibreRef.current.remove();
          mapLibreRef.current = null;
        }
        mapLibreLibRef.current = null;
        mapLibreMarkers.clear();
        mapLibreUserMarkerRef.current = null;
        setMapReady(false);
      };
    } else {
      // Leaflet fallback initialization
      if ((element as unknown as { _leaflet_id?: number })._leaflet_id) {
        if (leafletMapRef.current) {
          leafletMapRef.current.remove();
          leafletMapRef.current = null;
        }
        delete (element as unknown as { _leaflet_id?: number })._leaflet_id;
      }

      const markers = leafletMarkersRef.current;

      void import('leaflet')
        .then((L) => {
          if (cancelled || !containerRef.current) return;
          leafletLibRef.current = L;

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

          leafletMapRef.current = map;

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
            if (!cancelled && leafletMapRef.current) {
              leafletMapRef.current.invalidateSize();
            }
          }, 150);

          resizeObserver = new ResizeObserver(() => {
            if (!cancelled && leafletMapRef.current) {
              leafletMapRef.current.invalidateSize();
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
        if (resizeObserver) resizeObserver.disconnect();
        if (leafletMapRef.current) {
          leafletMapRef.current.remove();
          leafletMapRef.current = null;
        }
        leafletLibRef.current = null;
        markers.clear();
        leafletUserMarkerRef.current = null;
        delete (element as unknown as { _leaflet_id?: number })._leaflet_id;
        setMapReady(false);
      };
    }
  }, [isGoong, tileConfig.styleUrl]);

  // Step 2: Sync markers and bounds when kiosks or userOrigin change
  useEffect(() => {
    if (!mapReady) return;

    if (isGoong) {
      const map = mapLibreRef.current;
      const maplibregl = mapLibreLibRef.current;
      if (!map || !maplibregl) return;

      // Remove existing markers
      mapLibreMarkersRef.current.forEach((m) => m.remove());
      mapLibreMarkersRef.current.clear();

      if (mapLibreUserMarkerRef.current) {
        mapLibreUserMarkerRef.current.remove();
        mapLibreUserMarkerRef.current = null;
      }

      // Add user marker
      if (userOrigin && isValidLatitude(userOrigin.lat) && isValidLongitude(userOrigin.lon)) {
        const userEl = document.createElement('div');
        userEl.className = 'customer-map-user-pin';
        userEl.style.width = '16px';
        userEl.style.height = '16px';
        userEl.style.borderRadius = '50%';
        userEl.style.backgroundColor = '#1890ff';
        userEl.style.border = '3px solid #ffffff';
        userEl.style.boxShadow = '0 0 0 4px rgba(24, 144, 255, 0.35)';

        const userPopup = new maplibregl.Popup({ offset: 12 }).setText('Vị trí tìm kiếm của bạn');
        mapLibreUserMarkerRef.current = new maplibregl.Marker({ element: userEl })
          .setLngLat([userOrigin.lon, userOrigin.lat])
          .setPopup(userPopup)
          .addTo(map);
      }

      // Add kiosk markers
      kiosks.forEach((kiosk) => {
        if (isValidLatitude(kiosk.latitude) && isValidLongitude(kiosk.longitude)) {
          const markerEl = createKioskMarkerElement(kiosk);
          const marker = new maplibregl.Marker({ element: markerEl, anchor: 'bottom' })
            .setLngLat([kiosk.longitude, kiosk.latitude])
            .addTo(map);

          markerEl.addEventListener('click', () => {
            onSelectKioskRef.current?.(kiosk.id);
          });

          mapLibreMarkersRef.current.set(kiosk.id, marker);
        }
      });

      // Fit bounds
      const validCoords: [number, number][] = [];
      if (userOrigin && isValidLatitude(userOrigin.lat) && isValidLongitude(userOrigin.lon)) {
        validCoords.push([userOrigin.lon, userOrigin.lat]);
      }
      kiosks.forEach((k) => {
        if (isValidLatitude(k.latitude) && isValidLongitude(k.longitude)) {
          validCoords.push([k.longitude, k.latitude]);
        }
      });

      if (validCoords.length === 1) {
        map.setCenter(validCoords[0]);
        map.setZoom(14);
      } else if (validCoords.length > 1) {
        const bounds = new maplibregl.LngLatBounds();
        validCoords.forEach((coord) => bounds.extend(coord));
        map.fitBounds(bounds, { padding: 40, maxZoom: 15 });
      }
    } else {
      // Leaflet fallback markers
      const map = leafletMapRef.current;
      const L = leafletLibRef.current;
      if (!map || !L) return;

      leafletMarkersRef.current.forEach((m) => m.remove());
      leafletMarkersRef.current.clear();

      if (leafletUserMarkerRef.current) {
        leafletUserMarkerRef.current.remove();
        leafletUserMarkerRef.current = null;
      }

      if (userOrigin && isValidLatitude(userOrigin.lat) && isValidLongitude(userOrigin.lon)) {
        leafletUserMarkerRef.current = L.circleMarker([userOrigin.lat, userOrigin.lon], {
          radius: 8,
          color: '#0050b3',
          fillColor: '#91d5ff',
          fillOpacity: 1,
          weight: 3,
        })
          .addTo(map)
          .bindTooltip('Vị trí tìm kiếm của bạn', { permanent: false, direction: 'top' });
      }

      kiosks.forEach((kiosk) => {
        if (isValidLatitude(kiosk.latitude) && isValidLongitude(kiosk.longitude)) {
          const markerElement = createKioskMarkerElement(kiosk);
          const markerIcon = L.divIcon({
            html: markerElement,
            className: 'customer-leaflet-kiosk-icon leaflet-interactive',
            iconSize: [44, 48],
            iconAnchor: [22, 46],
          });
          const marker = L.marker([kiosk.latitude, kiosk.longitude], {
            icon: markerIcon,
            keyboard: false,
            interactive: false,
            title: kiosk.name,
          }).addTo(map);

          markerElement.addEventListener('click', () => {
            onSelectKioskRef.current?.(kiosk.id);
          });

          leafletMarkersRef.current.set(kiosk.id, marker);
        }
      });

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
    }
  }, [kiosks, userOrigin, mapReady, isGoong]);

  // Step 3: Handle selectedKioskId changes without rebuilding markers
  useEffect(() => {
    if (isGoong) {
      const map = mapLibreRef.current;
      mapLibreMarkersRef.current.forEach((candidate, kioskId) => {
        const element = candidate.getElement();
        element.classList.toggle('is-selected', kioskId === selectedKioskId);
        element.setAttribute('aria-pressed', String(kioskId === selectedKioskId));
      });
      if (!selectedKioskId) return;
      const marker = mapLibreMarkersRef.current.get(selectedKioskId);
      if (map && marker) {
        const lngLat = marker.getLngLat();
        map.flyTo({
          center: lngLat,
          zoom: Math.max(map.getZoom(), 14),
          offset: [0, -70],
          duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 400,
        });
      }
    } else {
      const map = leafletMapRef.current;
      leafletMarkersRef.current.forEach((candidate, kioskId) => {
        const markerElement = candidate.getElement()?.querySelector('.customer-map-kiosk-marker');
        markerElement?.classList.toggle('is-selected', kioskId === selectedKioskId);
        markerElement?.setAttribute('aria-pressed', String(kioskId === selectedKioskId));
        candidate.setZIndexOffset(kioskId === selectedKioskId ? 1000 : 0);
      });
      if (!selectedKioskId) return;
      const marker = leafletMarkersRef.current.get(selectedKioskId);
      if (map && marker) {
        map.setView(marker.getLatLng(), Math.max(map.getZoom(), 14));
      }
    }
  }, [selectedKioskId, kiosks, isGoong, mapReady, userOrigin]);

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
          <span className="legend-dot dot-active" aria-hidden="true" /> Đang hoạt động
        </span>
        <span className="legend-item">
          <span className="legend-dot dot-maintenance" aria-hidden="true" /> Bảo trì
        </span>
        <span className="legend-item">
          <span className="legend-dot dot-offline" aria-hidden="true" /> Ngoại tuyến
        </span>
        {userOrigin && (
          <span className="legend-item">
            <span className="legend-dot dot-user" aria-hidden="true" /> Vị trí của bạn
          </span>
        )}
      </div>
      <p
        className="customer-map-attribution"
        dangerouslySetInnerHTML={{ __html: tileConfig.attribution }}
      />
      {tileError && (
        <p className="kiosk-map-tile-warning" role="status">
          Bản đồ chưa tải được đầy đủ hình ảnh. Bạn vẫn có thể xem danh sách địa chỉ và bấm chỉ
          đường bên dưới.
        </p>
      )}
    </div>
  );
}
