import { useId } from 'react';
import Select from './Select';
import { kioskOptions, type KioskOption } from '../lib/kiosk-filter';
import styles from './kiosk-filter.module.css';

export default function KioskFilter({
  items,
  value,
  onChange,
}: {
  items: KioskOption[];
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const options = kioskOptions(items);
  return (
    <div className={styles.field}>
      <label htmlFor={id}>Kiosk</label>
      <Select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Tất cả kiosk</option>
        {value && !options.some((option) => option.id === value) && (
          <option value={value}>Kiosk đã chọn</option>
        )}
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </Select>
    </div>
  );
}
