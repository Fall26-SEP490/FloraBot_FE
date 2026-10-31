'use client';
import { useState } from 'react';
import KioskMap from './KioskMap';
import { fetchLandingLocations } from './landing-api';
import { kioskDirections, type LocationsState } from './landing-data';
export default function KioskLocations({ initial }: { initial: LocationsState }) {
  const [state, setState] = useState(initial);
  const [loading, setLoading] = useState(false);
  async function retry() {
    setLoading(true);
    try {
      setState({ items: await fetchLandingLocations(), error: false });
    } catch {
      setState({ items: [], error: true });
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="location-layout" aria-busy={loading}>
      <div>
        {loading && <p role="status">Đang tải vị trí kiosk…</p>}
        {state.error ? (
          <div role="alert" className="landing-data-status">
            <p>Chưa tải được địa điểm kiosk.</p>
            <button
              className="button button-outline"
              type="button"
              disabled={loading}
              onClick={() => void retry()}
            >
              Tải lại địa điểm
            </button>
          </div>
        ) : !state.items.length ? (
          <p role="status">Chưa có kiosk công khai có vị trí hoàn chỉnh.</p>
        ) : (
          <ul className="location-list">
            {state.items.map((item) => (
              <li key={item.id} data-kiosk-id={item.id}>
                <h3>{item.name}</h3>
                <p>{item.address}</p>
                <p>
                  {item.code} · {item.status === 'ONLINE' ? 'Đang kết nối' : 'Chưa kết nối'}
                </p>
                <a
                  className="text-link"
                  href={kioskDirections(item)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Chỉ đường đến {item.name}
                </a>
              </li>
            ))}
          </ul>
        )}
        <a className="text-link" href="#dang-ky">
          Tư vấn vị trí thuê
        </a>
      </div>
      <KioskMap kiosks={state.error ? [] : state.items} />
      <noscript>
        <p>
          Danh sách địa chỉ ở trên dùng được khi tắt JavaScript. Bật JavaScript để mở bản đồ tương
          tác.
        </p>
      </noscript>
    </div>
  );
}
