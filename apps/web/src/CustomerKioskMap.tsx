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
import {
  type CustomerKioskLocationItem,
  isValidLatitude,
  isValidLongitude,
  getKioskStatusLabel,
  buildGoogleMapsDirectionsUrl,
} from './kioskTypes';
import { getMapTileConfig, buildGoongDirectionsUrl } from './goongMaps';

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
  marker.setAttribute('aria-label', `Kiosk ${kiosk.name}: ${getKioskStatusLabel(kiosk.status)}`);
  marker.title = `${kiosk.name} · ${getKioskStatusLabel(kiosk.status)}`;

  const pin = document.createElement('span');
  pin.className = 'customer-map-kiosk-pin';
  pin.setAttribute('aria-hidden', 'true');

  const glyph = document.createElement('span');
  glyph.className = 'customer-map-kiosk-glyph';
  glyph.textContent = '✿';
  pin.appendChild(glyph);
  marker.appendChild(pin);

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
          const statusLabel = getKioskStatusLabel(kiosk.status);
          const markerEl = createKioskMarkerElement(kiosk);

          // Popup container
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

          const actionEl = document.createElement('div');
          actionEl.style.marginTop = '8px';
          actionEl.style.display = 'flex';
          actionEl.style.gap = '8px';

          const googleDirUrl = buildGoogleMapsDirectionsUrl(kiosk.latitude, kiosk.longitude);
          const goongDirUrl = buildGoongDirectionsUrl(
            kiosk.latitude,
            kiosk.longitude,
            userOrigin?.lat,
            userOrigin?.lon,
          );

          const gLink = document.createElement('a');
          gLink.href = googleDirUrl;
          gLink.target = '_blank';
          gLink.rel = 'noopener noreferrer';
          gLink.style.color = '#174b35';
          gLink.style.fontWeight = '600';
          gLink.style.fontSize = '12px';
          gLink.style.textDecoration = 'underline';
          gLink.textContent = 'Google Maps →';
          actionEl.appendChild(gLink);

          const goongLink = document.createElement('a');
          goongLink.href = goongDirUrl;
          goongLink.target = '_blank';
          goongLink.rel = 'noopener noreferrer';
          goongLink.style.color = '#2563eb';
          goongLink.style.fontWeight = '600';
          goongLink.style.fontSize = '12px';
          goongLink.style.textDecoration = 'underline';
          goongLink.textContent = 'Goong Maps →';
          actionEl.appendChild(goongLink);

          popupContainer.appendChild(actionEl);

          const popup = new maplibregl.Popup({ offset: 30, maxWidth: '280px' }).setDOMContent(
            popupContainer,
          );

          const marker = new maplibregl.Marker({ element: markerEl, anchor: 'bottom' })
            .setLngLat([kiosk.longitude, kiosk.latitude])
            .setPopup(popup)
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
          const statusLabel = getKioskStatusLabel(kiosk.status);
          const markerElement = createKioskMarkerElement(kiosk);
          const markerIcon = L.divIcon({
            html: markerElement,
            className: 'customer-leaflet-kiosk-icon leaflet-interactive',
            iconSize: [40, 48],
            iconAnchor: [20, 46],
            popupAnchor: [0, -42],
          });
          const marker = L.marker([kiosk.latitude, kiosk.longitude], {
            icon: markerIcon,
            keyboard: true,
            title: kiosk.name,
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
        candidate.getElement().classList.toggle('is-selected', kioskId === selectedKioskId);
      });
      if (!selectedKioskId) return;
      const marker = mapLibreMarkersRef.current.get(selectedKioskId);
      if (map && marker) {
        const lngLat = marker.getLngLat();
        map.flyTo({ center: lngLat, zoom: Math.max(map.getZoom(), 14) });
        if (!marker.getPopup().isOpen()) {
          marker.togglePopup();
        }
      }
    } else {
      const map = leafletMapRef.current;
      leafletMarkersRef.current.forEach((candidate, kioskId) => {
        const markerElement = candidate.getElement()?.querySelector('.customer-map-kiosk-marker');
        markerElement?.classList.toggle('is-selected', kioskId === selectedKioskId);
      });
      if (!selectedKioskId) return;
      const marker = leafletMarkersRef.current.get(selectedKioskId);
      if (map && marker) {
        marker.openPopup();
        map.setView(marker.getLatLng(), Math.max(map.getZoom(), 14));
      }
    }
  }, [selectedKioskId, kiosks, isGoong]);

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
