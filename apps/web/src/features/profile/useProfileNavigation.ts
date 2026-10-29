import { useEffect, useState } from 'react';

export const profileSections = [
  ['identity-heading', 'Tài khoản'],
  ['basic-info-heading', 'Thông tin cá nhân'],
  ['contact-email-heading', 'Email liên hệ'],
  ['personal-bank-heading', 'Ngân hàng'],
  ['security', 'Bảo mật'],
] as const;

export function useProfileNavigation(ready: boolean) {
  const [activeSection, setActiveSection] = useState<string>('identity-heading');
  useEffect(() => {
    if (!ready) return;
    let frame = 0;
    const update = () => {
      const header = document.querySelector('.site-header');
      const threshold =
        (header?.getBoundingClientRect().height ?? 76) + (innerWidth < 900 ? 140 : 100);
      let current: string = profileSections[0][0];
      for (const [id] of profileSections) {
        if ((document.getElementById(id)?.getBoundingClientRect().top ?? Infinity) <= threshold)
          current = id;
      }
      setActiveSection(current);
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    schedule();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    window.addEventListener('hashchange', schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('hashchange', schedule);
    };
  }, [ready]);
  return { activeSection, setActiveSection };
}
