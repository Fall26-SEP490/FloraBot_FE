'use client';

import {
  createContext,
  useContext,
  useRef,
  useState,
  useEffect,
  type ComponentProps,
  type ReactNode,
} from 'react';
import styles from './refresh-region.module.css';

const RefreshContext = createContext<((work: Promise<unknown>) => void) | null>(null);
export function useRefreshRegion() {
  return useContext(RefreshContext);
}

export default function RefreshRegion({
  children,
  ...props
}: ComponentProps<'div'> & { children: ReactNode }) {
  const [loading, setLoading] = useState(false);
  const generation = useRef(0);
  const pending = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(
    () => () => {
      generation.current++;
      pending.current = 0;
      clearTimeout(timer.current);
    },
    [],
  );
  function track(work: Promise<unknown>) {
    const current = generation.current;
    if (pending.current++ === 0) {
      timer.current = setTimeout(() => {
        if (generation.current === current) setLoading(true);
      }, 150);
    }
    const finish = () => {
      if (generation.current !== current) return;
      if (--pending.current > 0) return;
      clearTimeout(timer.current);
      setLoading(false);
    };
    void work.then(finish, finish);
  }
  return (
    <RefreshContext.Provider value={track}>
      <div
        {...props}
        className={`${styles.region} ${props.className || ''}`}
        aria-busy={loading}
        data-refresh-region=""
      >
        <div className={styles.content}>{children}</div>
        {loading && (
          <div className={styles.overlay} data-refresh-overlay="">
            <div className={styles.indicator} role="status">
              <span className={styles.progress} aria-hidden="true" />
              <span className="sr-only">Đang cập nhật dữ liệu…</span>
            </div>
          </div>
        )}
      </div>
    </RefreshContext.Provider>
  );
}
