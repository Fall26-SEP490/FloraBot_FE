'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { Flower2, ArrowRight } from '@florabot/ui';
import { Modal } from '@/shared/components/Modal';
import { ApiError, sessionQuery } from '@/shared/lib/api';
import styles from './styles/seasonal-welcome.module.css';

export interface SeasonalCampaign {
  id: string;
  storageKey: string;
  startDate: string;
  endDate: string;
  occasion: string;
  dateLabel: string;
  title: string;
  description: string;
  image: string;
  imageAlt: string;
  objectPosition?: string;
  href: string;
}

export const seasonalCampaigns: readonly SeasonalCampaign[] = [
  {
    id: 'christmas-2026',
    storageKey: 'florabot:welcome:christmas-2026',
    startDate: '2026-11-22',
    endDate: '2026-12-26',
    occasion: 'Noel',
    dateLabel: '24–25.12',
    title: 'Giáng sinh này, gửi hoa thay lời yêu thương.',
    description: 'Một bó hoa dành cho người bạn thương, để mùa Noel thêm ấm áp.',
    image: '/images/occasions/event-christmas-960.webp',
    imageAlt: 'Cây thông Giáng sinh rực sáng giữa quảng trường ấm áp đêm Noel',
    objectPosition: '42% 46%',
    href: '#mau-hoa',
  },
  {
    id: 'new-year-2027',
    storageKey: 'florabot:welcome:new-year-2027',
    startDate: '2026-12-26',
    endDate: '2027-01-04',
    occasion: 'Năm mới',
    dateLabel: '01.01',
    title: 'Khởi đầu năm mới rạng rỡ sắc hoa.',
    description: 'Gửi tặng bó hoa tươi thắm thay lời chúc bình an và may mắn ngày đầu năm.',
    image: '/images/occasions/event-new-year-960.webp',
    imageAlt: 'Pháo hoa rực sáng trên quảng trường lễ hội đón chào năm mới cùng sắc hoa tươi',
    objectPosition: '56% 48%',
    href: '#mau-hoa',
  },
  {
    id: 'tet-2027',
    storageKey: 'florabot:welcome:tet-2027',
    startDate: '2027-02-02',
    endDate: '2027-02-10',
    occasion: 'Tết Xuân',
    dateLabel: '06–09.02',
    title: 'Xuân Đinh Mùi, trao sắc hoa sum vầy.',
    description: 'Đặt trước hoa xuân tươi mới từ shop, hẹn nhận tiện lợi tại kiosk gần bạn.',
    image: '/images/occasions/event-tet-960.webp',
    imageAlt: 'Phố hoa Tết Việt Nam lung linh đèn lồng đỏ cùng sắc hoa mai vàng và hoa đào',
    objectPosition: '54% 52%',
    href: '#mau-hoa',
  },
  {
    id: 'valentine-2027',
    storageKey: 'florabot:welcome:valentine-2027',
    startDate: '2027-02-10',
    endDate: '2027-02-15',
    occasion: 'Valentine',
    dateLabel: '14.02',
    title: 'Mùa yêu thương, để đóa hoa nói lời chân thành.',
    description: 'Chọn bó hoa hồng tinh tế dành tặng người thương trong ngày Lễ Tình nhân.',
    image: '/images/occasions/event-valentine-960.webp',
    imageAlt: 'Bó hoa hồng đỏ lãng mạn bên ánh nến ấm áp đêm Lễ Tình nhân Valentine',
    objectPosition: '62% 55%',
    href: '#mau-hoa',
  },
  {
    id: 'womens-day-2027',
    storageKey: 'florabot:welcome:womens-day-2027',
    startDate: '2027-03-01',
    endDate: '2027-03-09',
    occasion: 'Quốc tế Phụ nữ',
    dateLabel: '08.03',
    title: 'Dành tặng phái đẹp những đóa hoa dịu dàng nhất.',
    description: 'Gửi lời tri ân và yêu thương đến những người phụ nữ trân quý quanh bạn.',
    image: '/images/occasions/flowerShop-960.webp',
    imageAlt: 'Không gian tiệm hoa rực rỡ sắc hồng và kem mừng ngày Quốc tế Phụ nữ 8/3',
    objectPosition: '52% 50%',
    href: '#mau-hoa',
  },
];

export function resolveSeasonalCampaign(
  today: string,
  preview: boolean,
  previewId?: string | null,
): SeasonalCampaign | null {
  if (preview && previewId) {
    const requested = seasonalCampaigns.find((item) => item.id === previewId);
    if (requested) return requested;
  }
  const active = seasonalCampaigns.find((item) => today >= item.startDate && today < item.endDate);
  if (active) return active;
  return preview ? seasonalCampaigns[0] : null;
}

export default function SeasonalWelcome() {
  const params = useSearchParams();
  const preview = process.env.NODE_ENV === 'development' && params.get('welcome') === 'preview';
  const previewOccasion = params.get('occasion');
  const session = useQuery(sessionQuery);
  const [activeCampaign, setActiveCampaign] = useState<SeasonalCampaign | null>(null);
  const allowed =
    session.data?.role === 'CUSTOMER' ||
    (session.isError && session.error instanceof ApiError && session.error.status === 401);

  useEffect(() => {
    if (!allowed && !preview) return;
    const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }).format(
      new Date(),
    );
    const campaign = resolveSeasonalCampaign(today, preview, previewOccasion);
    if (!campaign) return;
    try {
      if (!preview && localStorage.getItem(campaign.storageKey)) return;
    } catch {
      return;
    }
    const timer = window.setTimeout(() => {
      // Another tab may have already displayed the greeting.
      try {
        if (!preview) {
          if (localStorage.getItem(campaign.storageKey)) return;
          localStorage.setItem(campaign.storageKey, 'seen');
        }
      } catch {
        return;
      }
      setActiveCampaign(campaign);
    }, 650);
    return () => window.clearTimeout(timer);
  }, [allowed, preview, previewOccasion]);

  if (!activeCampaign || (!allowed && !preview)) return null;
  return createPortal(
    <Modal
      open
      title={activeCampaign.title}
      onClose={() => setActiveCampaign(null)}
      className={styles.welcome}
    >
      <div className={styles.visual}>
        <Image
          src={activeCampaign.image}
          alt={activeCampaign.imageAlt}
          width={1440}
          height={960}
          sizes="(max-width: 600px) 100vw, 840px"
          unoptimized
          className={styles.photo}
          style={
            activeCampaign.objectPosition
              ? ({ '--photo-position': activeCampaign.objectPosition } as CSSProperties)
              : undefined
          }
        />
        <span className={styles.brand} aria-hidden="true">
          <Flower2 size={19} /> FloraBot
        </span>
        <div className={styles.celebration} aria-hidden="true">
          {Array.from({ length: 18 }, (_, index) => (
            <i
              key={index}
              className={styles.snow}
              style={
                {
                  '--x': `${(index * 37 + 9) % 100}%`,
                  '--drift': `${((index % 3) - 1) * 26}px`,
                  '--duration': `${3.6 + (index % 5) * 0.65}s`,
                  '--delay': `-${(index * 470) % 4200}ms`,
                  '--size': `${3 + (index % 3) * 2}px`,
                  '--peak-opacity': `${0.35 + (index % 3) * 0.15}`,
                  '--blur': `${(index % 3) * 0.4}px`,
                } as CSSProperties
              }
            />
          ))}
        </div>
        <span className={styles.date}>
          {activeCampaign.occasion} <span>{activeCampaign.dateLabel}</span>
        </span>
      </div>
      <div
        className={styles.content}
        data-eyebrow={`${activeCampaign.occasion} · ${activeCampaign.dateLabel}`}
      >
        <p>{activeCampaign.description}</p>
        <a
          className="button button-primary"
          href={activeCampaign.href}
          data-autofocus
          onClick={() => setActiveCampaign(null)}
        >
          Khám phá hoa <ArrowRight size={17} aria-hidden="true" />
        </a>
        <button type="button" className={styles.later} onClick={() => setActiveCampaign(null)}>
          Để mình xem sau
        </button>
      </div>
    </Modal>,
    document.body,
  );
}
