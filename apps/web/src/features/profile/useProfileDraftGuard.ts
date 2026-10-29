import { useEffect, useRef, useState } from 'react';

export function useProfileDraftGuard(dirty: boolean) {
  const [pending, setPending] = useState(false);
  const pendingElement = useRef<HTMLElement | null>(null);
  const replayElement = useRef<HTMLElement | null>(null);
  const approved = useRef(false);

  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (approved.current) return;
      event.preventDefault();
      event.returnValue = '';
    };
    const resetApproval = () => {
      approved.current = false;
    };
    const click = (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
        return;
      const element =
        event.target instanceof Element
          ? event.target.closest<HTMLElement>('a[href], button[data-session-exit]')
          : null;
      if (!element) return;
      if (replayElement.current === element) {
        replayElement.current = null;
        return;
      }
      if (element instanceof HTMLAnchorElement) {
        if (element.hasAttribute('download') || (element.target && element.target !== '_self'))
          return;
        const target = new URL(element.href, window.location.href);
        if (
          target.origin === location.origin &&
          target.pathname === location.pathname &&
          target.search === location.search
        )
          return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      pendingElement.current = element;
      setPending(true);
    };
    window.addEventListener('beforeunload', beforeUnload);
    document.addEventListener('click', click, true);
    document.addEventListener('input', resetApproval, true);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      document.removeEventListener('click', click, true);
      document.removeEventListener('input', resetApproval, true);
    };
  }, [dirty]);

  return {
    pending,
    cancel: () => {
      pendingElement.current = null;
      setPending(false);
    },
    confirm: () => {
      const element = pendingElement.current;
      pendingElement.current = null;
      approved.current = true;
      replayElement.current = element;
      setPending(false);
      element?.click();
    },
    allowLeave: () => {
      approved.current = true;
    },
  };
}
