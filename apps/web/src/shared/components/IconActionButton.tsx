'use client';

import type { ComponentProps } from 'react';
import { Button, RefreshCw } from '@florabot/ui';
import styles from './icon-action-button.module.css';

type Props = Omit<ComponentProps<typeof Button>, 'children'> & {
  action: 'clear' | 'reload';
  label: string;
};

export default function IconActionButton({ action, label, className, ...props }: Props) {
  return (
    <Button
      type="button"
      variant="outline"
      {...props}
      className={`${styles.control} ${className || ''}`}
      data-icon-action={action}
      aria-label={props['aria-label'] || label}
      title={props.title || label}
    >
      {action === 'clear' ? (
        <svg
          width="23"
          height="23"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M3 6h18M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M5 6l1 14a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1l1-14M10 10v7M14 10v7" />
        </svg>
      ) : (
        <RefreshCw size={23} strokeWidth={1.8} aria-hidden="true" />
      )}
    </Button>
  );
}
