'use client';
import { useEffect, useRef, useState } from 'react';
import type { Map, LatLngTuple } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Button, useHydrated } from '@florabot/ui';
import { kioskDirections, type LandingLocation } from './landing-data';
export default function KioskMap({ kiosks }: { kiosks: LandingLocation[] }) {
  const ready = useHydrated();
  const container = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!enabled || !kiosks.length) return;
    let map: Map | undefined;
    let cancelled = false;
    void import('leaflet')
      .then(({ map: createMap, tileLayer, circleMarker }) => {
        if (cancelled || !container.current) return;
        map = createMap(container.current, {
          attributionControl: false,
          scrollWheelZoom: false,
          zoomAnimation: false,
          fadeAnimation: false,
          markerZoomAnimation: false,
        });
        const points = kiosks.map((item): LatLngTuple => [item.latitude, item.longitude]);
        map.fitBounds(points, { padding: [32, 32], maxZoom: 13 });
        tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 })
          .addTo(map)
          .on('tileerror', () => {
            if (!cancelled) {
              setError(true);
              setLoading(false);
            }
          });
        for (const item of kiosks) {
          const label = document.createElement('span');
          label.textContent = `${item.name} · ${item.code}`;
          const link = document.createElement('a');
          link.href = kioskDirections(item);
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          link.textContent = `Chỉ đường đến ${item.name}`;
          const marker = circleMarker([item.latitude, item.longitude], {
            radius: 7,
            color: '#174b35',
            fillColor: '#d6e9c5',
            fillOpacity: 1,
            weight: 2,
          })
            .addTo(map)
            .bindTooltip(label, {
              permanent: true,
              direction: 'top',
              className: 'florabot-map-label',
            })
            .bindPopup(link);
          const path = marker.getElement();
          path?.setAttribute('data-kiosk-id', item.id);
          path?.setAttribute('aria-label', `${item.name} · ${item.code}`);
          path?.setAttribute('role', 'img');
        }
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [enabled, kiosks, revision]);
  function openMap() {
    setError(false);
    setLoading(true);
    setEnabled(true);
    setRevision((value) => value + 1);
  }
  return (
    <div className="map-panel">
      {!enabled && (
        <div className="map-placeholder">
          <h3>Xem vị trí trên bản đồ</h3>
          <Button variant="outline" disabled={!ready || !kiosks.length} onClick={openMap}>
            Mở bản đồ
          </Button>
        </div>
      )}
      {enabled && kiosks.length > 0 && (
        <>
          <div
            ref={container}
            className="kiosk-map"
            role="region"
            aria-label="Bản đồ các kiosk công khai"
          />
          <p className="map-attribution">
            Dữ liệu bản đồ © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> ·{' '}
            <a href="https://leafletjs.com">Leaflet</a>
          </p>
        </>
      )}
      {loading && <p role="status">Đang tải bản đồ…</p>}
      {error && (
        <div role="status">
          <p>Bản đồ chưa tải đầy đủ. Danh sách địa chỉ và liên kết chỉ đường vẫn dùng được.</p>
          <Button variant="outline" onClick={openMap}>
            Thử lại bản đồ
          </Button>
        </div>
      )}
    </div>
  );
}
