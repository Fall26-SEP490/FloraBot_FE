import Link from 'next/link';
import { ArrowUpRight, MapPin, Navigation, Store } from '@florabot/ui';
import type { CustomerKioskLocationItem } from '../kiosk-location/kiosk-location.types';
import {
  buildGoogleMapsDirectionsUrl,
  getKioskStatusLabel,
  isKioskActive,
  isValidLatitude,
  isValidLongitude,
} from '../kiosk-location/kiosk-location.utils';
import { mentionedKiosks } from './flower-advisor.utils';
import styles from './flower-advisor-kiosks.module.css';

export function FlowerAdvisorKioskCards({
  question,
  message,
  items,
}: {
  question: string;
  message: string;
  items: CustomerKioskLocationItem[];
}) {
  const matches = mentionedKiosks(question, message, items);
  if (!matches.length) return null;
  return (
    <ul className={styles.list} aria-label="Kiosk được FloraBot gợi ý">
      {matches.map((kiosk) => {
        const mapped = isValidLatitude(kiosk.latitude) && isValidLongitude(kiosk.longitude);
        return (
          <li className={styles.card} key={kiosk.id}>
            <div className={styles.heading}>
              <Link
                href={`/tim-kiosk?kiosk=${encodeURIComponent(kiosk.id)}`}
                className={styles.name}
              >
                {kiosk.name || kiosk.code}
                <ArrowUpRight size={14} aria-hidden="true" />
              </Link>
              <span
                className={styles.status}
                data-online={isKioskActive(kiosk.status)}
                data-state={kiosk.status}
              >
                {getKioskStatusLabel(kiosk.status)}
              </span>
            </div>
            <p className={styles.address}>
              <MapPin size={14} aria-hidden="true" />
              <span>{kiosk.address || 'Chưa cập nhật địa chỉ cụ thể'}</span>
            </p>
            <div className={styles.actions}>
              <Link href="/dat-hoa" className={styles.shop}>
                <Store size={14} aria-hidden="true" />
                Xem mẫu hoa
              </Link>
              {mapped ? (
                <a
                  className={styles.directions}
                  href={buildGoogleMapsDirectionsUrl(kiosk.latitude!, kiosk.longitude!)}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Chỉ đường đến ${kiosk.name} (mở tab mới)`}
                >
                  <Navigation size={13} aria-hidden="true" />
                  Chỉ đường
                  <ArrowUpRight size={12} aria-hidden="true" />
                </a>
              ) : (
                <Link
                  className={styles.directions}
                  href={`/tim-kiosk?kiosk=${encodeURIComponent(kiosk.id)}`}
                >
                  Xem vị trí tủ
                  <ArrowUpRight size={12} aria-hidden="true" />
                </Link>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
