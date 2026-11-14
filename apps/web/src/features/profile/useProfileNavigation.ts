import { useCallback, useEffect, useRef, useState } from 'react';

export type ProfileSectionItem = readonly [id: string, label: string];

export const profileSections: readonly ProfileSectionItem[] = [
  ['identity-heading', 'Tài khoản'],
  ['basic-info-heading', 'Thông tin cá nhân'],
  ['contact-email-heading', 'Email liên hệ'],
  ['personal-bank-heading', 'Ngân hàng'],
  ['security', 'Bảo mật'],
] as const;

export function getProfileSections(
  role?: string | null,
  hasShopBank?: boolean,
): readonly ProfileSectionItem[] {
  if (role !== 'SELLER') return profileSections;
  return [
    ['identity-heading', 'Tài khoản'],
    ['basic-info-heading', 'Thông tin cá nhân'],
    ['contact-email-heading', 'Email liên hệ'],
    ['personal-bank-heading', 'Ngân hàng'],
    ['seller-shop-heading', 'Hồ sơ shop'],
    ...(hasShopBank ? ([['shop-bank-heading', 'Ngân hàng shop']] as const) : []),
    ['security', 'Bảo mật'],
  ];
}

function syncQuickNavFade(navigation: Element | null) {
  if (!(navigation instanceof HTMLElement)) return;
  const maxScroll = navigation.scrollWidth - navigation.clientWidth;
  if (maxScroll <= 2) {
    navigation.dataset.scrollFade = 'none';
    return;
  }
  const canLeft = navigation.scrollLeft > 4;
  const canRight = navigation.scrollLeft < maxScroll - 4;
  if (canLeft && canRight) navigation.dataset.scrollFade = 'both';
  else if (canRight) navigation.dataset.scrollFade = 'right';
  else if (canLeft) navigation.dataset.scrollFade = 'left';
  else navigation.dataset.scrollFade = 'none';
}

export function useProfileNavigation(
  ready: boolean,
  sections: readonly ProfileSectionItem[] = profileSections,
) {
  const [activeSection, setCurrentSection] = useState<string>('identity-heading');
  const requestedSection = useRef<string | null>(null);

  const setActiveSection = useCallback((id: string) => {
    // A deliberate anchor choice takes priority over the height of a short section.
    requestedSection.current = id;
    if (id === 'security')
      document
        .querySelector<HTMLDetailsElement>('.profile-security-disclosure')
        ?.setAttribute('open', '');
    setCurrentSection(id);
  }, []);

  useEffect(() => {
    if (!ready) return;
    let frame = 0;
    let previousSection: string | undefined;
    const navEl = document.querySelector('.profile-quick-nav');
    const update = () => {
      const header = document.querySelector('.site-header');
      const navigation = navEl;
      const horizontal = navigation && getComputedStyle(navigation).flexDirection !== 'column';
      const top = horizontal
        ? navigation.getBoundingClientRect().bottom
        : (header?.getBoundingClientRect().bottom ?? 0);
      const threshold = top + Math.min(120, Math.max(80, (innerHeight - top) * 0.16));
      let current: string = sections[0]?.[0] ?? 'identity-heading';
      if (window.scrollY > 1) {
        for (const [id] of sections) {
          const element = document.getElementById(id);
          const section = element?.closest('.profile-section, .shop-bank-section') ?? element;
          if ((section?.getBoundingClientRect().top ?? Infinity) <= threshold) current = id;
        }
        if (Math.ceil(window.scrollY + innerHeight) >= document.documentElement.scrollHeight - 2)
          current = 'security';
      }
      current = requestedSection.current ?? current;
      if (current !== previousSection && horizontal && navigation) {
        const link = navigation.querySelector<HTMLAnchorElement>(`a[href="#${current}"]`);
        if (link) {
          const bounds = navigation.getBoundingClientRect();
          const target = link.getBoundingClientRect();
          if (target.left < bounds.left || target.right > bounds.right)
            navigation.scrollLeft += target.left - bounds.left - 8;
        }
        syncQuickNavFade(navigation);
      }
      previousSection = current;
      setCurrentSection(current);
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    const onDocumentScroll = (event: Event) => {
      if (event.target !== navEl) schedule();
    };
    const onNavScroll = () => syncQuickNavFade(navEl);
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
      if (id === 'security')
        document
          .querySelector<HTMLDetailsElement>('.profile-security-disclosure')
          ?.setAttribute('open', '');
      requestedSection.current = sections.some(([section]) => section === id) ? id : null;
      schedule();
    };
    onHashChange();
    syncQuickNavFade(navEl);
    navEl?.addEventListener('scroll', onNavScroll, { passive: true });
    document.addEventListener('scroll', onDocumentScroll, { passive: true, capture: true });
    window.addEventListener('wheel', clearIntent, { passive: true, capture: true });
    window.addEventListener('touchmove', clearIntent, { passive: true, capture: true });
    window.addEventListener('pointerdown', clearIntent, { passive: true, capture: true });
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', schedule);
    window.addEventListener('hashchange', onHashChange);
    return () => {
      cancelAnimationFrame(frame);
      navEl?.removeEventListener('scroll', onNavScroll);
      document.removeEventListener('scroll', onDocumentScroll, true);
      window.removeEventListener('wheel', clearIntent, true);
      window.removeEventListener('touchmove', clearIntent, true);
      window.removeEventListener('pointerdown', clearIntent, true);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('hashchange', onHashChange);
    };
  }, [ready, sections]);
  return { activeSection, setActiveSection };
}
