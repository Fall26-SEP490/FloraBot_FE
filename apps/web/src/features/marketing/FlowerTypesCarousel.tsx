'use client';

import { useEffect, useRef, type CSSProperties, type MouseEvent, type PointerEvent } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from '@florabot/ui';
import { flowerTags, type FlowerTypeCode } from '@/shared/lib/flower-tags';

const flowerPhotos = {
  rose: 'redRoses',
  tulip: 'stripedTulips',
  sunflower: 'sunflowers',
  lily: 'pinkLilies',
} as const;

const illustratedTypes = [
  'chrysanthemum',
  'gerbera',
  'lisianthus',
  'carnation',
  'hydrangea',
  'orchid',
  'peony',
  'babys-breath',
] as const satisfies readonly FlowerTypeCode[];

export default function FlowerTypesCarousel() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const direction = useRef(1);
  const resumeAfter = useRef(0);
  const touching = useRef(false);
  const drag = useRef<{ id: number; x: number; left: number } | null>(null);
  const dragged = useRef(false);

  useEffect(() => {
    const strip = scrollRef.current;
    if (!strip) return;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const hover = window.matchMedia('(hover: hover)');
    let visible = false;
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
    });
    observer.observe(strip);
    const timer = window.setInterval(() => {
      if (
        !visible ||
        document.hidden ||
        motion.matches ||
        touching.current ||
        drag.current ||
        performance.now() < resumeAfter.current ||
        (hover.matches && strip.matches(':hover')) ||
        strip.matches(':focus-within')
      )
        return;

      const limit = strip.scrollWidth - strip.clientWidth;
      if (limit <= 1) return;
      if (strip.scrollLeft >= limit - 1) direction.current = -1;
      else if (strip.scrollLeft <= 0) direction.current = 1;
      strip.scrollLeft += direction.current;
    }, 40);
    return () => {
      observer.disconnect();
      window.clearInterval(timer);
    };
  }, []);

  function delayAutoplay() {
    resumeAfter.current = performance.now() + 5000;
  }

  function startDrag(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    dragged.current = false;
    drag.current = { id: event.pointerId, x: event.clientX, left: event.currentTarget.scrollLeft };
  }

  function dragStrip(event: PointerEvent<HTMLDivElement>) {
    const start = drag.current;
    if (!start || start.id !== event.pointerId) return;
    const strip = event.currentTarget;
    const delta = event.clientX - start.x;
    if (!dragged.current) {
      if (Math.abs(delta) < 6) return;
      dragged.current = true;
      strip.setPointerCapture(event.pointerId);
    }
    strip.scrollLeft = start.left - delta;
  }

  function stopDrag(event: PointerEvent<HTMLDivElement>) {
    if (drag.current?.id !== event.pointerId) return;
    drag.current = null;
    delayAutoplay();
  }

  function cancelDragClick(event: MouseEvent<HTMLAnchorElement>) {
    if (event.detail === 0 || !dragged.current) return;
    dragged.current = false;
    event.preventDefault();
  }

  function move(step: number) {
    const strip = scrollRef.current;
    const first = strip?.children[0];
    const second = strip?.children[1];
    if (!strip || !first || !second) return;
    const distance = second.getBoundingClientRect().left - first.getBoundingClientRect().left;
    const limit = strip.scrollWidth - strip.clientWidth;
    const target = strip.scrollLeft + step * distance * 2;
    delayAutoplay();
    direction.current = step;
    strip.scrollTo({
      left:
        step < 0 && strip.scrollLeft <= 1
          ? limit
          : step > 0 && strip.scrollLeft >= limit - 1
            ? 0
            : target,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'instant'
        : 'smooth',
    });
  }

  return (
    <section className="home-occasions" aria-labelledby="flower-types-title">
      <div className="home-occasions-header">
        <h2 id="flower-types-title" className="home-occasions-title">
          Chọn theo loại hoa
        </h2>
      </div>
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Drag scroll has keyboard-accessible arrow buttons. */}
      <div
        ref={scrollRef}
        id="flower-types-strip"
        className="home-occasions-carousel"
        role="region"
        aria-label="Danh sách loại hoa"
        onTouchStart={() => {
          touching.current = true;
        }}
        onTouchEnd={() => {
          touching.current = false;
          delayAutoplay();
        }}
        onTouchCancel={() => {
          touching.current = false;
          delayAutoplay();
        }}
        onWheel={delayAutoplay}
        onPointerDown={startDrag}
        onPointerMove={dragStrip}
        onPointerUp={stopDrag}
        onPointerCancel={stopDrag}
        onLostPointerCapture={stopDrag}
        onPointerLeave={(event) => {
          if (!event.currentTarget.hasPointerCapture(event.pointerId)) stopDrag(event);
        }}
        onDragStart={(event) => event.preventDefault()}
      >
        {Object.entries(flowerPhotos).map(([type, image]) => (
          <Link
            key={type}
            href={`/dat-hoa?flower=${type}`}
            className="occasion-item"
            onClick={cancelDragClick}
          >
            <div className="occasion-avatar-wrap">
              <img
                src={`/images/occasions/${image}-480.webp`}
                alt=""
                className="occasion-avatar-img"
                loading="lazy"
                width={96}
                height={96}
              />
            </div>
            <span className="occasion-label">{flowerTags[type as keyof typeof flowerPhotos]}</span>
          </Link>
        ))}
        {illustratedTypes.map((type, index) => (
          <Link
            key={type}
            href={`/dat-hoa?flower=${type}`}
            className="occasion-item"
            onClick={cancelDragClick}
          >
            <div className="occasion-avatar-wrap">
              <span
                className="occasion-avatar-img occasion-avatar-illustration"
                style={
                  {
                    '--flower-position': `${(index % 3) * 50}% ${Math.floor(index / 3) * 50}%`,
                  } as CSSProperties
                }
                aria-hidden="true"
              />
            </div>
            <span className="occasion-label">{flowerTags[type]}</span>
          </Link>
        ))}
        <Link href="/dat-hoa" className="occasion-item" onClick={cancelDragClick}>
          <div className="occasion-avatar-wrap">
            <span className="occasion-avatar-img occasion-avatar-illustration" aria-hidden="true" />
          </div>
          <span className="occasion-label">Tất cả mẫu</span>
        </Link>
      </div>
      <div className="home-occasions-nav" role="group" aria-label="Điều hướng loại hoa">
        <button
          type="button"
          className="occasions-arrow-btn"
          onClick={() => move(-1)}
          aria-controls="flower-types-strip"
          aria-label="Xem loại hoa trước"
        >
          <ChevronLeft size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="occasions-arrow-btn"
          onClick={() => move(1)}
          aria-controls="flower-types-strip"
          aria-label="Xem loại hoa tiếp theo"
        >
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
