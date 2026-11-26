'use client';

import {
  useEffect,
  useLayoutEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
  type Ref,
} from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, Clock, ChevronLeft, ChevronRight, X } from '@florabot/ui';
import { CustomSelect } from './CustomSelect';
import { displayVietnamDate, vietnamDate } from '@/shared/lib/vietnam-date';
import styles from './vietnam-date-input.module.css';

export default function VietnamDateInput({
  id,
  value,
  onValueChange,
  kind = 'date',
  min,
  max,
  required,
  disabled,
  name,
  label,
  describedBy,
  invalid,
  triggerRef,
  showToday = true,
}: {
  id?: string;
  value: string;
  onValueChange: (value: string) => void;
  kind?: 'date' | 'datetime-local' | 'month' | 'time';
  min?: string;
  max?: string;
  required?: boolean;
  disabled?: boolean;
  name?: string;
  label?: string;
  describedBy?: string;
  invalid?: boolean;
  triggerRef?: Ref<HTMLButtonElement>;
  showToday?: boolean;
}) {
  const generated = useId();
  const fieldId = id ?? generated;
  const popupId = `${fieldId}-calendar`;
  const trigger = useRef<HTMLButtonElement>(null);
  useImperativeHandle(triggerRef, () => trigger.current!, []);
  const hidden = useRef<HTMLInputElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const [view, setView] = useState(() =>
    (kind === 'time' ? vietnamDate() : value || vietnamDate()).slice(0, 7),
  );
  const [hour, setHour] = useState(
    () => (kind === 'time' ? value.slice(0, 2) : value.slice(11, 13)) || '00',
  );
  const [minute, setMinute] = useState(
    () => (kind === 'time' ? value.slice(3, 5) : value.slice(14, 16)) || '00',
  );
  const open = position !== null;
  const year = Number(view.slice(0, 4));
  const month = Number(view.slice(5, 7));
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const start = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
  const inputLabel =
    label || (kind === 'month' ? 'Chọn tháng' : kind === 'time' ? 'Chọn giờ' : 'Chọn ngày');
  function commit(next: string) {
    onValueChange(next);
    if (hidden.current) {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(
        hidden.current,
        next,
      );
      hidden.current.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }
  function close() {
    setPosition(null);
    trigger.current?.focus({ preventScroll: true });
  }
  function expand() {
    const rect = trigger.current!.getBoundingClientRect();
    setView((kind === 'time' ? vietnamDate() : value || vietnamDate()).slice(0, 7));
    setHour((kind === 'time' ? value.slice(0, 2) : value.slice(11, 13)) || '00');
    setMinute((kind === 'time' ? value.slice(3, 5) : value.slice(14, 16)) || '00');
    const height = kind === 'datetime-local' ? 438 : kind === 'month' ? 250 : 356;
    setPosition({
      left: Math.max(8, Math.min(rect.left, innerWidth - 320)),
      top: Math.max(8, Math.min(rect.bottom + 6, innerHeight - height - 8)),
    });
  }
  function allowed(date: string) {
    return (
      (!min || date >= min.slice(0, date.length)) && (!max || date <= max.slice(0, date.length))
    );
  }
  function move(delta: number) {
    const date = new Date(Date.UTC(year, month - 1 + delta, 1));
    setView(
      `${String(date.getUTCFullYear()).padStart(4, '0')}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`,
    );
  }
  useLayoutEffect(() => {
    if (!open || !popup.current || !trigger.current) return;
    const rect = trigger.current.getBoundingClientRect();
    const panel = popup.current;
    setPosition({
      left: Math.max(8, Math.min(rect.left, innerWidth - panel.offsetWidth - 8)),
      top: Math.max(8, Math.min(rect.bottom + 6, innerHeight - panel.offsetHeight - 8)),
    });
  }, [open, view, kind]);
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      const rect = trigger.current?.getBoundingClientRect();
      if (rect && popup.current) {
        const height = popup.current.offsetHeight;
        setPosition({
          left: Math.max(8, Math.min(rect.left, innerWidth - 320)),
          top: Math.max(8, Math.min(rect.bottom + 6, innerHeight - height - 8)),
        });
      }
      (
        popup.current?.querySelector<HTMLElement>('[data-selected="true"]') ??
        popup.current?.querySelector<HTMLElement>('button')
      )?.focus({ preventScroll: true });
    });
    const outside = (event: PointerEvent) => {
      if (
        !popup.current?.contains(event.target as Node) &&
        !trigger.current?.contains(event.target as Node) &&
        !(event.target as Element)?.closest('[role="listbox"]')
      )
        setPosition(null);
    };
    const moved = (event: Event) => {
      if (
        popup.current?.contains(event.target as Node) ||
        (event.target instanceof Element && event.target.closest('[role="listbox"]'))
      )
        return;
      const rect = trigger.current?.getBoundingClientRect();
      if (!rect) return;
      const height = popup.current?.offsetHeight || 438;
      setPosition({
        left: Math.max(8, Math.min(rect.left, innerWidth - 320)),
        top: Math.max(8, Math.min(rect.bottom + 6, innerHeight - height - 8)),
      });
    };
    const escape = (event: KeyboardEvent) => {
      if (
        event.key === 'Escape' &&
        popup.current?.querySelector('[role="combobox"][aria-expanded="true"]')
      )
        return;
      if (event.key === 'Escape') {
        event.stopImmediatePropagation();
        event.preventDefault();
        setPosition(null);
        trigger.current?.focus({ preventScroll: true });
      }
      if (event.key === 'Tab') {
        const fields = Array.from(
          popup.current?.querySelectorAll<HTMLElement>('button:not(:disabled), [tabindex="0"]') ??
            [],
        );
        const first = fields[0],
          last = fields.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('pointerdown', outside);
    window.addEventListener('resize', moved);
    window.addEventListener('scroll', moved, true);
    // Capture before the containing drawer's focus trap and Escape listener.
    window.addEventListener('keydown', escape, true);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('pointerdown', outside);
      window.removeEventListener('resize', moved);
      window.removeEventListener('scroll', moved, true);
      window.removeEventListener('keydown', escape, true);
    };
  }, [open]);
  const yearStart = Math.max(Number(min?.slice(0, 4)) || 1, Math.min(1900, year));
  const yearEnd = Math.min(
    9999,
    Number(max?.slice(0, 4)) || 9999,
    Math.max(Number(vietnamDate().slice(0, 4)) + 10, year),
  );
  return (
    <span className={styles.field} data-vietnam-date="">
      <input
        ref={hidden}
        className={styles.validationInput}
        tabIndex={-1}
        aria-hidden="true"
        value={value}
        onChange={() => {}}
        required={required}
        disabled={disabled}
        name={name}
        data-vn-kind={kind}
        data-min={min}
        data-max={max}
      />
      <button
        ref={trigger}
        id={fieldId}
        type="button"
        role="combobox"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? popupId : undefined}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        aria-required={required || undefined}
        disabled={disabled}
        className={styles.trigger}
        onClick={() => (open ? close() : expand())}
      >
        <span>
          {(kind === 'time'
            ? value
            : displayVietnamDate(value, kind === 'datetime-local', kind === 'month')) ||
            (kind === 'month'
              ? 'mm/yyyy'
              : kind === 'time'
                ? 'HH:mm'
                : kind === 'datetime-local'
                  ? 'dd/mm/yyyy HH:mm'
                  : 'dd/mm/yyyy')}
        </span>
        {kind === 'time' ? (
          <Clock size={17} aria-hidden="true" />
        ) : (
          <CalendarDays size={17} aria-hidden="true" />
        )}
      </button>
      {open &&
        createPortal(
          <div
            ref={popup}
            id={popupId}
            data-vietnam-calendar=""
            role="dialog"
            aria-label={`${inputLabel} (giờ Việt Nam)`}
            className={styles.popup}
            style={position}
          >
            <div className={styles.heading}>
              <strong>{inputLabel}</strong>
              <button type="button" aria-label="Đóng lịch" onClick={close}>
                <X size={17} />
              </button>
            </div>
            {kind !== 'time' && (
              <div className={styles.navigation}>
                <button
                  type="button"
                  aria-label="Tháng trước"
                  disabled={year <= 1 && month === 1}
                  onClick={() => move(-1)}
                >
                  <ChevronLeft size={17} />
                </button>
                <div>
                  <label htmlFor={`${fieldId}-month`}>Tháng</label>
                  <CustomSelect
                    id={`${fieldId}-month`}
                    value={String(month)}
                    onValueChange={(m) => setView(`${year}-${m.padStart(2, '0')}`)}
                    options={Array.from({ length: 12 }, (_, i) => ({
                      value: String(i + 1),
                      label: String(i + 1),
                    }))}
                  />
                </div>
                <div>
                  <label htmlFor={`${fieldId}-year`}>Năm</label>
                  <CustomSelect
                    id={`${fieldId}-year`}
                    value={String(year)}
                    onValueChange={(y) =>
                      setView(`${y.padStart(4, '0')}-${String(month).padStart(2, '0')}`)
                    }
                    options={Array.from({ length: yearEnd - yearStart + 1 }, (_, i) => ({
                      value: String(yearEnd - i),
                      label: String(yearEnd - i),
                    }))}
                  />
                </div>
                <button
                  type="button"
                  aria-label="Tháng sau"
                  disabled={year >= 9999 && month === 12}
                  onClick={() => move(1)}
                >
                  <ChevronRight size={17} />
                </button>
              </div>
            )}
            {kind === 'month' ? (
              <div className={styles.months}>
                {Array.from({ length: 12 }, (_, i) => {
                  const date = `${year}-${String(i + 1).padStart(2, '0')}`;
                  return (
                    <button
                      type="button"
                      key={date}
                      data-selected={date === value}
                      disabled={!allowed(date)}
                      onClick={() => {
                        commit(date);
                        close();
                      }}
                    >
                      Tháng {i + 1}
                    </button>
                  );
                })}
              </div>
            ) : (
              <>
                {kind !== 'time' && (
                  <div className={styles.calendar}>
                    {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((day) => (
                      <small key={day}>{day}</small>
                    ))}
                    {Array.from({ length: start }, (_, i) => (
                      <span key={`blank-${i}`} />
                    ))}
                    {Array.from({ length: days }, (_, i) => {
                      const date = `${view}-${String(i + 1).padStart(2, '0')}`;
                      return (
                        <button
                          type="button"
                          key={date}
                          aria-label={displayVietnamDate(date)}
                          aria-pressed={date === value.slice(0, 10)}
                          data-selected={date === value.slice(0, 10)}
                          disabled={!allowed(date)}
                          onClick={() => {
                            commit(kind === 'datetime-local' ? `${date}T${hour}:${minute}` : date);
                            if (kind === 'date') close();
                          }}
                        >
                          {i + 1}
                        </button>
                      );
                    })}
                  </div>
                )}
                {(kind === 'datetime-local' || kind === 'time') && (
                  <div className={styles.time}>
                    <label htmlFor={`${fieldId}-hour`}>Giờ</label>
                    <CustomSelect
                      id={`${fieldId}-hour`}
                      value={hour}
                      options={Array.from({ length: 24 }, (_, i) => ({
                        value: String(i).padStart(2, '0'),
                        label: String(i).padStart(2, '0'),
                        disabled:
                          kind === 'datetime-local' &&
                          Boolean(value) &&
                          !allowed(`${value.slice(0, 10)}T${String(i).padStart(2, '0')}:00`) &&
                          !allowed(`${value.slice(0, 10)}T${String(i).padStart(2, '0')}:59`),
                      }))}
                      onValueChange={(h) => {
                        setHour(h);
                        if (kind === 'time') commit(`${h}:${minute}`);
                        else if (value) commit(`${value.slice(0, 10)}T${h}:${minute}`);
                      }}
                    />
                    <label htmlFor={`${fieldId}-minute`}>Phút</label>
                    <CustomSelect
                      id={`${fieldId}-minute`}
                      value={minute}
                      options={Array.from({ length: 60 }, (_, i) => ({
                        value: String(i).padStart(2, '0'),
                        label: String(i).padStart(2, '0'),
                        disabled:
                          kind === 'datetime-local' &&
                          Boolean(value) &&
                          !allowed(`${value.slice(0, 10)}T${hour}:${String(i).padStart(2, '0')}`),
                      }))}
                      onValueChange={(m) => {
                        setMinute(m);
                        if (kind === 'time') commit(`${hour}:${m}`);
                        else if (value) commit(`${value.slice(0, 10)}T${hour}:${m}`);
                      }}
                    />
                  </div>
                )}
              </>
            )}
            <div className={styles.footer}>
              {!required && (
                <button
                  type="button"
                  onClick={() => {
                    commit('');
                    close();
                  }}
                >
                  Xóa
                </button>
              )}
              {kind !== 'time' && showToday && (
                <button
                  type="button"
                  disabled={!allowed(kind === 'month' ? vietnamDate().slice(0, 7) : vietnamDate())}
                  onClick={() => {
                    const today = vietnamDate();
                    if (allowed(kind === 'month' ? today.slice(0, 7) : today)) {
                      commit(
                        kind === 'datetime-local'
                          ? `${today}T${hour}:${minute}`
                          : kind === 'month'
                            ? today.slice(0, 7)
                            : today,
                      );
                      if (kind !== 'datetime-local') close();
                    }
                  }}
                >
                  {kind === 'month' ? 'Tháng này' : 'Hôm nay'}
                </button>
              )}
              <button
                type="button"
                className={styles.done}
                onClick={() => {
                  if (kind === 'time' && !value) commit(`${hour}:${minute}`);
                  close();
                }}
              >
                Xong
              </button>
            </div>
          </div>,
          document.body,
        )}
    </span>
  );
}
