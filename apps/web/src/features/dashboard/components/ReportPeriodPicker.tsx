import { useEffect, useId, useRef, useState } from 'react';
import { Button, ChevronDown } from '@florabot/ui';
import VietnamDateInput from '@/shared/components/VietnamDateInput';
import { sellerReportPeriod } from '../seller-report.utils';
import styles from './report-period-picker.module.css';

export type ReportPeriodSelection = {
  mode: 'month' | 'range';
  month: string;
  from: string;
  to: string;
};
const dayLabel = (day: string) => day.split('-').reverse().join('/');
export default function ReportPeriodPicker({
  value,
  onChange,
}: {
  value: ReportPeriodSelection;
  onChange: (value: ReportPeriodSelection) => void;
}) {
  const id = useId();
  const field = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!open) return;
    field.current?.querySelector<HTMLButtonElement>('[data-period-tab]')?.focus();
    function outside(event: PointerEvent) {
      const target = event.target;
      if (
        !(target instanceof Element) ||
        field.current?.contains(target) ||
        target.closest('[data-vietnam-calendar], [role="listbox"]')
      )
        return;
      setOpen(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setOpen(false);
      trigger.current?.focus();
    }
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);
  function close() {
    setOpen(false);
    trigger.current?.focus();
  }
  const label =
    value.mode === 'month'
      ? `Tháng ${value.month.slice(5)}/${value.month.slice(0, 4)}`
      : value.from === value.to
        ? dayLabel(value.from)
        : `${dayLabel(value.from)} – ${dayLabel(value.to)}`;
  return (
    <div className={styles.field} ref={field}>
      <label htmlFor={id}>Thời gian</label>
      <button
        ref={trigger}
        id={id}
        type="button"
        className={styles.trigger}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? `${id}-panel` : undefined}
        onClick={() => {
          if (open) close();
          else {
            setDraft(value);
            setError('');
            setOpen(true);
          }
        }}
      >
        <span>{label}</span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {open && (
        <div
          id={`${id}-panel`}
          role="dialog"
          aria-label="Chọn thời gian báo cáo"
          className={styles.popup}
        >
          <div className={styles.tabs} role="group" aria-label="Cách chọn thời gian">
            {(
              [
                ['month', 'Tháng'],
                ['range', 'Ngày'],
              ] as const
            ).map(([mode, title]) => (
              <button
                key={mode}
                type="button"
                data-period-tab="true"
                aria-pressed={draft.mode === mode}
                onClick={() => {
                  setDraft({ ...draft, mode });
                  setError('');
                }}
              >
                {title}
              </button>
            ))}
          </div>
          {draft.mode === 'month' ? (
            <div>
              <label htmlFor={`${id}-month`}>Tháng</label>
              <VietnamDateInput
                id={`${id}-month`}
                kind="month"
                value={draft.month}
                onValueChange={(month) => {
                  setDraft({ ...draft, month });
                  setError('');
                }}
              />
            </div>
          ) : (
            <div className={styles.dates}>
              <div>
                <label htmlFor={`${id}-from`}>Từ ngày</label>
                <VietnamDateInput
                  id={`${id}-from`}
                  label="Từ ngày"
                  value={draft.from}
                  max={draft.to || undefined}
                  onValueChange={(from) => {
                    setDraft({ ...draft, from });
                    setError('');
                  }}
                />
              </div>
              <div>
                <label htmlFor={`${id}-to`}>Đến ngày</label>
                <VietnamDateInput
                  id={`${id}-to`}
                  label="Đến ngày"
                  value={draft.to}
                  min={draft.from || undefined}
                  onValueChange={(to) => {
                    setDraft({ ...draft, to });
                    setError('');
                  }}
                />
              </div>
            </div>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <div className={styles.actions}>
            <Button type="button" variant="outline" onClick={close}>
              Hủy
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (!sellerReportPeriod(draft.mode, draft.month, draft.from, draft.to)) {
                  setError('Chọn thời gian hợp lệ.');
                  return;
                }
                onChange(draft);
                close();
              }}
            >
              Áp dụng
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
