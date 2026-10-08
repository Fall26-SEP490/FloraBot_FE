'use client';

import { useEffect, useRef, useState } from 'react';
import type { Map } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Button, useHydrated } from '@florabot/ui';
export default function KioskMap() {
  const ready = useHydrated();
  const container = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let map: Map | undefined;
    let cancelled = false;
    void import('leaflet')
      .then(({ map: createMap, tileLayer, circleMarker }) => {
        if (cancelled || !container.current) return;
        map = createMap(container.current, {
          scrollWheelZoom: false,
          zoomAnimation: false,
          fadeAnimation: false,
          markerZoomAnimation: false,
          maxBounds: [
            [5, 100],
            [24, 118],
          ],
          maxBoundsViscosity: 1,
        }).setView([15.5, 109], 5);
        map.attributionControl.setPosition('topright');
        tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 18,
          minZoom: 4,
        })
          .addTo(map)
          .on('tileerror', () => setError(true));
        const points: [number, number, string][] = [
          [10.7822, 106.6955, 'Nhà Văn hóa Thanh Niên · vị trí demo'],
          [10.8414, 106.8098, 'Đại học FPT, Thủ Đức · vị trí demo'],
          [16.5, 112, 'Quần đảo Hoàng Sa (Việt Nam)'],
          [9.5, 114, 'Quần đảo Trường Sa (Việt Nam)'],
        ];
        for (const [lat, lng, name] of points)
          circleMarker([lat, lng], {
            radius: 6,
            color: '#252525',
            fillColor: '#ffcf24',
            fillOpacity: 1,
            weight: 2,
          })
            .addTo(map)
            .bindTooltip(name, {
              permanent: true,
              direction: lng > 111 ? 'left' : 'top',
              className: 'florabot-map-label',
            });
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
  }, [enabled]);
  return (
    <div className="map-panel">
      {!enabled && (
        <div className="map-placeholder">
          <h3>Xem vị trí trên bản đồ</h3>
          <Button
            variant="outline"
            disabled={!ready}
            onClick={() => {
              setLoading(true);
              setEnabled(true);
            }}
          >
            Mở bản đồ
          </Button>
        </div>
      )}
      {enabled && (
        <div
          ref={container}
          className="kiosk-map"
          role="region"
          aria-label="Bản đồ hai vị trí kiosk minh họa, Hoàng Sa và Trường Sa của Việt Nam"
        />
      )}
      {loading && <p role="status">Đang tải bản đồ…</p>}
      {error && (
        <p role="status">Bản đồ chưa tải đầy đủ. Bạn có thể xem địa chỉ trong danh sách.</p>
      )}
    </div>
  );
}
