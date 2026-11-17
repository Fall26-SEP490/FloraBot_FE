'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from '@florabot/ui';
import { flowerTags } from '@/shared/lib/flower-tags';

interface FlowerTypeItem {
  label: string;
  image: string;
  alt: string;
  href: string;
}

const flowerCollections: FlowerTypeItem[] = [
  {
    label: flowerTags.rose,
    image: '/images/occasions/redRoses-480.webp',
    alt: 'Bó hoa hồng đỏ',
    href: '/dat-hoa?flower=rose',
  },
  {
    label: flowerTags.tulip,
    image: '/images/occasions/stripedTulips-480.webp',
    alt: 'Bó hoa tulip',
    href: '/dat-hoa?flower=tulip',
  },
  {
    label: flowerTags.sunflower,
    image: '/images/occasions/sunflowers-480.webp',
    alt: 'Hoa hướng dương vàng',
    href: '/dat-hoa?flower=sunflower',
  },
  {
    label: flowerTags.lily,
    image: '/images/occasions/pinkLilies-480.webp',
    alt: 'Hoa ly hồng',
    href: '/dat-hoa?flower=lily',
  },
  {
    label: 'Tất cả mẫu',
    image: '/images/occasions/callaLilies-480.webp',
    alt: 'Khám phá tất cả các mẫu hoa tươi FloraBot',
    href: '/dat-hoa',
  },
];

export default function FlowerTypesCarousel() {
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleScroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const scrollAmount = 260;
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'instant'
        : 'smooth',
    });
  };

  return (
    <section className="home-occasions" aria-labelledby="flower-types-title">
      <div className="home-occasions-header">
        <h2 id="flower-types-title" className="home-occasions-title">
          Chọn theo loại hoa
        </h2>
      </div>

      <div
        ref={scrollRef}
        className="home-occasions-carousel"
        role="region"
        aria-label="Danh sách loại hoa"
      >
        {flowerCollections.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="occasion-item"
            aria-label={item.href === '/dat-hoa' ? 'Xem tất cả mẫu hoa' : `Xem mẫu ${item.label}`}
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
