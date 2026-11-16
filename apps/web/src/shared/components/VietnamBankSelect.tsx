'use client';

import { useEffect, useId, useRef, useState, type Ref } from 'react';
import { ChevronDown } from '@florabot/ui';
import bankList from '../data/vietnam-bank-list.json';
import styles from './vietnam-bank-select.module.css';

const fold = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/đ/g, 'd');

const banks = bankList.map(({ name, nameEn, code }) => ({
  name,
  code,
  search: fold(`${name} ${nameEn ?? ''} ${code ?? ''}`),
}));
const names = new Set(banks.map((bank) => bank.name));

export function VietnamBankSelect({
  id,
  value,
  onValueChange,
  inputRef,
  onBlur,
  describedBy,
  invalid,
  required,
  disabled,
}: {
  id: string;
  value: string;
  onValueChange: (name: string) => void;
  inputRef?: Ref<HTMLInputElement>;
  onBlur?: () => void;
  describedBy?: string;
  invalid?: boolean;
  required?: boolean;
  disabled?: boolean;
}) {
  const listboxId = useId();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const [active, setActive] = useState(-1);
  const activeOption = useRef<HTMLDivElement>(null);
  const tokens = fold(draft ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const source =
    value && !names.has(value)
      ? [{ name: value, code: 'Đã lưu', search: fold(value) }, ...banks]
      : banks;
  const matches = source.filter((bank) => tokens.every((token) => bank.search.includes(token)));
  const expanded = open && !disabled;

  useEffect(() => {
    if (expanded) activeOption.current?.scrollIntoView({ block: 'nearest' });
  }, [active, expanded, draft]);

  function close() {
    setOpen(false);
    setActive(-1);
    setDraft(null);
  }

  function select(name: string) {
    onValueChange(name);
    close();
  }

  return (
    <div className={styles.field}>
      <div className={styles.inputWrap}>
        <input
          ref={inputRef}
          id={id}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={expanded}
          aria-controls={expanded ? listboxId : undefined}
          aria-activedescendant={expanded && matches[active] ? `${listboxId}-${active}` : undefined}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          aria-required={required}
          disabled={disabled}
          autoComplete="off"
          spellCheck={false}
          placeholder="Tìm theo tên hoặc mã ngân hàng"
          value={draft ?? value}
          onClick={(event) => {
            if (!open && value) event.currentTarget.select();
            setOpen(true);
          }}
          onChange={(event) => {
            setDraft(event.target.value);
            setActive(-1);
            setOpen(true);
          }}
          onBlur={() => {
            close();
            onBlur?.();
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape' && expanded) {
              event.preventDefault();
              event.stopPropagation();
              close();
              return;
            }
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault();
              setOpen(true);
              setActive((index) =>
                matches.length === 0
                  ? -1
                  : event.key === 'ArrowDown'
                    ? Math.min(index + 1, matches.length - 1)
                    : index <= 0
                      ? matches.length - 1
                      : index - 1,
              );
            }
            if (event.key === 'Enter' && expanded && !event.nativeEvent.isComposing) {
              event.preventDefault();
              const bank = matches[active] ?? (matches.length === 1 ? matches[0] : undefined);
              if (bank) select(bank.name);
            }
          }}
        />
        <ChevronDown size={16} className={styles.chevron} aria-hidden="true" />
      </div>
      {expanded && (
        <div className={styles.popup}>
          <div
            className={styles.options}
            role="listbox"
            aria-label="Ngân hàng Việt Nam"
            id={listboxId}
          >
            {matches.map(({ name, code }, index) => (
              <div
                ref={active === index ? activeOption : undefined}
                id={`${listboxId}-${index}`}
                key={name}
                role="option"
                tabIndex={-1}
                aria-selected={active >= 0 ? active === index : name === value}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => select(name)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    select(name);
                  }
                }}
              >
                <span>{name}</span>
                {code && <small>{code}</small>}
              </div>
            ))}
          </div>
          {matches.length === 0 && <p role="status">Không tìm thấy ngân hàng.</p>}
        </div>
      )}
    </div>
  );
}
