'use client';
import { useEffect } from 'react';
export default function MarketingEffects() {
  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const entranceAnimations = new Set<Animation>();
    const sections = [...document.querySelectorAll('.section')];
    const animateEntrance = (element: Element, delay = 0, direction?: number) => {
      if (reducedMotion.matches) return;
      const graphic = element.matches('img');
      const sectionIndex = sections.indexOf(element.closest('.section')!);
      const step = element.closest('li');
      const stepIndex = step ? [...step.parentElement!.children].indexOf(step) : -1;
      const from = direction ?? ((stepIndex >= 0 ? stepIndex : sectionIndex) % 2 === 0 ? -1 : 1);
      const distance = Math.min(window.innerWidth * 0.09, graphic ? 48 : 72);
      const animation = element.animate(
        [
          graphic
            ? { opacity: 0.45, transform: `translateX(${from * distance}px) scale(.98)` }
            : { opacity: 0.15, transform: `translateX(${from * distance}px)` },
          { opacity: 1, transform: 'none' },
        ],
        { duration: graphic ? 1100 : 1000, delay, easing: 'cubic-bezier(.22,1,.36,1)' },
      );
      entranceAnimations.add(animation);
      void animation.finished.then(
        () => entranceAnimations.delete(animation),
        () => entranceAnimations.delete(animation),
      );
    };
    document
      .querySelectorAll('.hero h1 > span, .hero-copy > p, .hero-actions')
      .forEach((element, index) => animateEntrance(element, index * 100, index === 1 ? 1 : -1));
    const entranceObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            animateEntrance(entry.target);
            entranceObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.2 },
    );
    document
      .querySelectorAll(
        '.section h2, .step-copy, .money-photo, .faq-visual img, .registration-flowers, .gift-picker-art img',
      )
      .forEach((element) => entranceObserver.observe(element));
    const onMotionChange = (event: MediaQueryListEvent) => {
      if (event.matches) entranceAnimations.forEach((animation) => animation.cancel());
    };
    reducedMotion.addEventListener('change', onMotionChange);
    const motionTargets = document.querySelectorAll(
      '.steps, .gift-demo, .graphic-divider, .section-next',
    );
    const motionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-in-view');
            motionObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 },
    );
    motionTargets.forEach((target) => motionObserver.observe(target));
    const choosePackage = (event: MouseEvent) => {
      const link = (event.target as Element).closest<HTMLAnchorElement>('.choose-package');
      if (!link) return;
      document.documentElement.dataset.selectedPackage = link.dataset.package;
      window.dispatchEvent(new CustomEvent('florabot:package', { detail: link.dataset.package }));
      document.querySelector<HTMLElement>('#dang-ky')?.focus({ preventScroll: true });
    };
    document.addEventListener('click', choosePackage);
    return () => {
      entranceObserver.disconnect();
      motionObserver.disconnect();
      entranceAnimations.forEach((animation) => animation.cancel());
      reducedMotion.removeEventListener('change', onMotionChange);
      document.removeEventListener('click', choosePackage);
    };
  }, []);
  return null;
}
