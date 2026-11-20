'use client';

import { useId } from 'react';
import { CustomSelect } from '@/shared/components/CustomSelect';
import styles from './directory-actions.module.css';

export default function DirectoryActions({
  name,
  statuses,
  disabled,
  onView,
  onStatus,
}: {
  name: string;
  statuses: string[];
  disabled?: boolean;
  onView: () => void;
  onStatus: (status: string) => void;
}) {
  const id = useId();
  return (
    <span className={styles.actions}>
      <CustomSelect
        id={id}
        value=""
        displayValue="Quản lý"
        disabled={disabled}
        popupMinWidth={180}
        buttonProps={{ className: styles.trigger, 'aria-label': `Quản lý ${name}` }}
        options={[
          { value: 'VIEW', label: 'Xem hồ sơ' },
          ...statuses.map((value) => ({
            value,
            label:
              value === 'ACTIVE'
                ? 'Khôi phục'
                : value === 'LOCKED'
                  ? 'Khóa tài khoản'
                  : 'Vô hiệu hóa',
          })),
        ]}
        onValueChange={(value) => (value === 'VIEW' ? onView() : onStatus(value))}
      />
    </span>
  );
}
