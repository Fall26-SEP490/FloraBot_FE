import { useCallback, useEffect, useRef, useState } from 'react';

export const profileSections = [
  ['identity-heading', 'Tài khoản'],
  ['basic-info-heading', 'Thông tin cá nhân'],
  ['contact-email-heading', 'Email liên hệ'],
  ['personal-bank-heading', 'Ngân hàng'],
  ['security', 'Bảo mật'],
] as const;

export function useProfileNavigation(ready: boolean) {
  const [activeSection, setCurrentSection] = useState<string>('identity-heading');
  const requestedSection = useRef<string | null>(null);
  const setActiveSection = useCallback((id: string) => {
    // A deliberate anchor choice takes priority over the height of a short section.
    requestedSection.current = id;
    setCurrentSection(id);
  }, []);

  useEffect(() => {
    if (!ready) return;
    let frame = 0;
    const update = () => {
      const header = document.querySelector('.site-header');
      const navigation = document.querySelector('.profile-quick-nav');
      const horizontal = navigation && getComputedStyle(navigation).flexDirection !== 'column';
      const top = horizontal
        ? navigation.getBoundingClientRect().bottom
        : (header?.getBoundingClientRect().bottom ?? 0);
      const threshold = top + Math.min(120, Math.max(80, (innerHeight - top) * 0.16));
      let current: string = profileSections[0][0];
      if (window.scrollY > 1) {
        for (const [id] of profileSections) {
          const section = document.getElementById(id)?.closest('.profile-section');
          if ((section?.getBoundingClientRect().top ?? Infinity) <= threshold) current = id;
        }
        if (Math.ceil(window.scrollY + innerHeight) >= document.documentElement.scrollHeight - 2)
          current = 'security';
      }
      current = requestedSection.current ?? current;
      if (horizontal && navigation) {
        const link = navigation.querySelector<HTMLAnchorElement>(`a[href="#${current}"]`);
        if (link) {
          const bounds = navigation.getBoundingClientRect();
          const target = link.getBoundingClientRect();
          if (target.left < bounds.left || target.right > bounds.right)
            navigation.scrollLeft += target.left - bounds.left - 8;
        }
      }
      setCurrentSection(current);
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    const clearIntent = () => {
      requestedSection.current = null;
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' ', 'Tab'].includes(
          event.key,
        )
      )
        clearIntent();
    };
    const onHashChange = () => {
      const id = window.location.hash.slice(1);
      requestedSection.current = profileSections.some(([section]) => section === id) ? id : null;
      schedule();
    };
    onHashChange();
    document.addEventListener('scroll', schedule, { passive: true, capture: true });
    window.addEventListener('wheel', clearIntent, { passive: true, capture: true });
    window.addEventListener('touchmove', clearIntent, { passive: true, capture: true });
    window.addEventListener('pointerdown', clearIntent, { passive: true, capture: true });
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', schedule);
    window.addEventListener('hashchange', onHashChange);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('scroll', schedule, true);
      window.removeEventListener('wheel', clearIntent, true);
      window.removeEventListener('touchmove', clearIntent, true);
      window.removeEventListener('pointerdown', clearIntent, true);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('hashchange', onHashChange);
    };
  }, [ready]);
  return { activeSection, setActiveSection };
}
