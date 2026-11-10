'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from '@florabot/ui';

export interface OccasionItem {
  label: string;
  image: string;
  alt: string;
  href: string;
}

export const occasionCollections: OccasionItem[] = [
  {
    label: 'Sinh nhật',
    image: '/images/occasions/pastelBouquet-480.webp',
    alt: 'Bó hoa tươi pastel mừng sinh nhật',
    href: '/dat-hoa?occasion=Sinh+nh%E1%BA%ADt',
  },
  {
    label: 'Tình yêu',
    image: '/images/occasions/redRoses-480.webp',
    alt: 'Bó hoa hồng đỏ tình yêu lãng mạn',
    href: '/dat-hoa?occasion=T%C3%ACnh+y%C3%AAu',
  },
  {
    label: 'Khai trương',
    image: '/images/occasions/flowerShop-480.webp',
    alt: 'Lẵng hoa tươi chúc mừng khai trương',
    href: '/dat-hoa?occasion=Khai+tr%C6%B0%C6%A1ng',
  },
  {
    label: 'Chúc mừng',
    image: '/images/occasions/sunflowers-480.webp',
    alt: 'Hoa hướng dương tươi rực rỡ chúc mừng',
    href: '/dat-hoa?occasion=Ch%C3%BAc+m%E1%BB%ABng',
  },
  {
    label: 'Kỷ niệm',
    image: '/images/occasions/tulipVase-480.webp',
    alt: 'Bình hoa tulip kỷ niệm ngày đặc biệt',
    href: '/dat-hoa?occasion=K%E1%BB%B7+ni%E1%BB%87m',
  },
  {
    label: 'Tốt nghiệp',
    image: '/images/occasions/stripedTulips-480.webp',
    alt: 'Bó hoa tươi chúc mừng tốt nghiệp',
    href: '/dat-hoa?occasion=T%E1%BB%91t+nghi%E1%BB%87p',
  },
  {
    label: 'Cảm ơn',
    image: '/images/occasions/cherryBlossom-480.webp',
    alt: 'Bó hoa trang nhã tri ân và cảm ơn',
    href: '/dat-hoa?occasion=C%E1%BA%A3m+%C6%A1n',
  },
  {
    label: 'Tất cả mẫu',
    image: '/images/occasions/callaLilies-480.webp',
    alt: 'Khám phá tất cả các mẫu hoa tươi FloraBot',
    href: '/dat-hoa',
  },
];

export default function OccasionsCarousel() {
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleScroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const scrollAmount = 260;
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  return (
    <section className="home-occasions" aria-labelledby="occasions-title">
      <div className="home-occasions-header">
        <h2 id="occasions-title" className="home-occasions-title">
          Chọn hoa theo dịp
        </h2>
      </div>

      <div
        ref={scrollRef}
        className="home-occasions-carousel"
        role="region"
        aria-label="Danh sách bộ sưu tập dịp tặng hoa"
      >
        {occasionCollections.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="occasion-item"
            aria-label={`Mẫu hoa dịp ${item.label}`}
          >
            <div className="occasion-avatar-wrap">
              <img
                src={item.image}
                alt={item.alt}
                className="occasion-avatar-img"
                loading="lazy"
                width={96}
                height={96}
              />
            </div>
            <span className="occasion-label">{item.label}</span>
          </Link>
        ))}
      </div>

      <div className="home-occasions-nav" aria-label="Điều hướng bộ sưu tập">
        <button
          type="button"
          className="occasions-arrow-btn"
          onClick={() => handleScroll('left')}
          aria-label="Xem bộ sưu tập trước"
        >
          <ChevronLeft size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="occasions-arrow-btn"
          onClick={() => handleScroll('right')}
          aria-label="Xem bộ sưu tập tiếp theo"
        >
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
