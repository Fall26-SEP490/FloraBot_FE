import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { Modal } from '@/shared/components/Modal';
import styles from './seller-orders.module.css';

export default function SellerOrderDrawer(
  props: Omit<ComponentProps<typeof Modal>, 'open' | 'className'>,
) {
  const [closing, setClosing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  function close() {
    if (timer.current) return;
    setClosing(true);
    const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 180;
    timer.current = setTimeout(props.onClose, duration);
  }
  return (
    <Modal
      {...props}
      open
      onClose={close}
      className={`${styles.orderDrawer}${closing ? ` ${styles.drawerClosing}` : ''}`}
    />
  );
}
