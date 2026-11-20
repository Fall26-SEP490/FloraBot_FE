'use client';

import {
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
  type CSSProperties,
  type ComponentPropsWithRef,
} from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from '@florabot/ui';
import styles from './custom-select.module.css';

type Option = { value: string; label: string; disabled?: boolean };
function popupPosition(rect: DOMRect): CSSProperties {
  const below = innerHeight - rect.bottom;
  const above = below < 200 && rect.top > below;
  return {
    left: Math.max(8, Math.min(rect.left, innerWidth - rect.width - 8)),
    width: Math.min(rect.width, innerWidth - 16),
    top: above ? undefined : rect.bottom + 6,
    bottom: above ? innerHeight - rect.top + 6 : undefined,
    maxHeight: Math.min(280, Math.max(80, (above ? rect.top : below) - 16)),
  };
}
export function CustomSelect({
  id,
  value,
  displayValue,
  options,
  onValueChange,
  disabled = false,
  buttonProps,
}: {
  id: string;
  value: string;
  displayValue?: string;
  options: Option[];
  onValueChange: (value: string) => void;
  disabled?: boolean;
  buttonProps?: Omit<
    ComponentPropsWithRef<'button'>,
    'id' | 'type' | 'role' | 'value' | 'onChange' | 'children'
  >;
}) {
  const listId = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  useImperativeHandle(buttonProps?.ref, () => trigger.current!, []);
  const popup = useRef<HTMLDivElement>(null);
  const search = useRef({ text: '', at: 0 });
  const [position, setPosition] = useState<CSSProperties | null>(null);
  const [active, setActive] = useState(-1);
  const open = !!position && !disabled;
  function expand() {
    const rect = trigger.current!.getBoundingClientRect();
    setPosition(popupPosition(rect));
    setActive(
      Math.max(
        0,
        options.findIndex((option) => option.value === value && !option.disabled),
      ),
    );
  }
  function choose(index: number) {
    const option = options[index];
    if (option && !option.disabled) onValueChange(option.value);
    setPosition(null);
  }
  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (
        !trigger.current?.contains(event.target as Node) &&
        !popup.current?.contains(event.target as Node)
      )
        setPosition(null);
    };
    const closeOnMove = (event: Event) => {
      if (!popup.current?.contains(event.target as Node) && trigger.current)
        setPosition(popupPosition(trigger.current.getBoundingClientRect()));
    };
    document.addEventListener('pointerdown', closeOutside);
    window.addEventListener('resize', closeOnMove);
    window.addEventListener('scroll', closeOnMove, true);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      window.removeEventListener('resize', closeOnMove);
      window.removeEventListener('scroll', closeOnMove, true);
    };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const list = popup.current;
    const option = list?.querySelector<HTMLElement>('[data-active="true"]');
    if (!list || !option) return;
    const top = option.offsetTop;
    const bottom = top + option.offsetHeight;
    if (top < list.scrollTop) list.scrollTop = top;
    else if (bottom > list.scrollTop + list.clientHeight)
      list.scrollTop = bottom - list.clientHeight;
  }, [active, open]);
  return (
    <>
      <button
        {...buttonProps}
        ref={trigger}
        id={id}
        type="button"
        role="combobox"
        className={`${styles.trigger} ${buttonProps?.className || ''}`}
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && options[active] ? `${listId}-${active}` : undefined}
        onBlur={(event) => {
          setPosition(null);
          buttonProps?.onBlur?.(event);
        }}
        onClick={() => (open ? setPosition(null) : expand())}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && open) {
            event.preventDefault();
            event.stopPropagation();
            setPosition(null);
            return;
          }
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            if (open) choose(active);
            else expand();
            return;
          }
          if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
            event.preventDefault();
            if (!open) {
              expand();
              return;
            }
            const indices = options.flatMap((o, index) => (o.disabled ? [] : [index]));
            if (!indices.length) return;
            const current = indices.indexOf(active);
            setActive(
              event.key === 'Home'
                ? indices[0]
                : event.key === 'End'
                  ? indices.at(-1)!
                  : indices[
                      (current + (event.key === 'ArrowDown' ? 1 : -1) + indices.length) %
                        indices.length
                    ],
            );
          } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
            const now = Date.now();
            search.current = {
              text:
                (now - search.current.at < 700 ? search.current.text : '') +
                event.key.toLocaleLowerCase('vi'),
              at: now,
            };
            if (!open) expand();
            const match = options.findIndex(
              (o) => !o.disabled && o.label.toLocaleLowerCase('vi').startsWith(search.current.text),
            );
            if (match >= 0) setActive(match);
          }
        }}
      >
        <span>{displayValue ?? options.find((o) => o.value === value)?.label ?? 'Chọn…'}</span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {open &&
        createPortal(
          <div
            ref={popup}
            id={listId}
            role="listbox"
            aria-labelledby={id}
            className={styles.popup}
            style={position!}
          >
            {options.map((option, index) => (
              <div
                key={option.value}
                id={`${listId}-${index}`}
                role="option"
                data-value={option.value}
                tabIndex={-1}
                aria-selected={option.value === value}
                aria-disabled={option.disabled || undefined}
                data-active={index === active}
                className={styles.option}
                onPointerDown={(e) => e.preventDefault()}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    choose(index);
                  }
                }}
                onMouseMove={() => !option.disabled && setActive(index)}
                onClick={(event) => {
                  event.stopPropagation();
                  if (!option.disabled) choose(index);
                }}
              >
                <span>{option.label}</span>
                {option.value === value && <Check size={16} aria-hidden="true" />}
              </div>
            ))}
            {!options.length && <p className={styles.empty}>Không có lựa chọn.</p>}
          </div>,
          document.body,
        )}
    </>
  );
}
