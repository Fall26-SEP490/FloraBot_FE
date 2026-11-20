'use client';

import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { createPortal } from 'react-dom';
import { Modal } from './Modal';
import styles from './side-panel.module.css';

export default function SidePanel(props: Omit<ComponentProps<typeof Modal>, 'open' | 'size'>) {
  const [closing, setClosing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  function close() {
    if (props.closeDisabled || timer.current) return;
    setClosing(true);
    const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 180;
    timer.current = setTimeout(props.onClose, duration);
  }
  if (typeof document === 'undefined') return null;
  return createPortal(
    <Modal
      {...props}
      open
      size="lg"
      onClose={close}
      className={`${styles.panel} ${closing ? styles.closing : ''} ${props.className || ''}`}
    />,
    document.body,
  );
}
