'use client';

import {
  Children,
  isValidElement,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type ReactNode,
} from 'react';
import { CustomSelect } from './CustomSelect';
import styles from './select.module.css';

function textOf(node: ReactNode): string {
  return Children.toArray(node)
    .map((child) => {
      if (typeof child === 'string' || typeof child === 'number') return String(child);
      if (isValidElement<{ children?: ReactNode }>(child)) return textOf(child.props.children);
      return '';
    })
    .join('');
}

function optionsOf(
  children: ReactNode,
): { value: string; label: string; disabled?: boolean; hidden?: boolean }[] {
  return Children.toArray(children).flatMap((child) => {
    if (
      !isValidElement<{
        value?: string | number;
        label?: string;
        children?: ReactNode;
        disabled?: boolean;
        hidden?: boolean;
      }>(child)
    )
      return [];
    if (child.type !== 'option') return optionsOf(child.props.children);
    const label = (child.props.label ?? textOf(child.props.children)).replace(/\s+/g, ' ').trim();
    return [
      {
        value: String(child.props.value ?? label),
        label,
        disabled: child.props.disabled,
        hidden: child.props.hidden,
      },
    ];
  });
}

/** Native form semantics with the site's shared dropdown UI. */
export default function Select({
  children,
  ref,
  id,
  className,
  style,
  onChange,
  onBlur,
  onFocus,
  popupMinWidth,
  ...props
}: ComponentPropsWithRef<'select'> & { popupMinWidth?: number }) {
  const generated = useId();
  const fieldId = id || generated;
  const native = useRef<HTMLSelectElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useImperativeHandle(ref, () => native.current!, []);
  const options = optionsOf(children);
  const [selected, setSelected] = useState(() =>
    String(props.value ?? props.defaultValue ?? options[0]?.value ?? ''),
  );
  // Form libraries can reset the native element imperatively. Read it after DOM updates.
  useLayoutEffect(() => {
    if (native.current) {
      setSelected(native.current.value);
    }
  }, [children, props.value, props.defaultValue]);
  useLayoutEffect(() => {
    const form = native.current?.form;
    let frame = 0;
    const reset = () => {
      frame = requestAnimationFrame(() => setSelected(native.current?.value ?? ''));
    };
    form?.addEventListener('reset', reset);
    return () => {
      form?.removeEventListener('reset', reset);
      cancelAnimationFrame(frame);
    };
  }, []);
  function choose(value: string) {
    const node = native.current;
    if (!node) return;
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set?.call(node, value);
    node.dispatchEvent(new Event('input', { bubbles: true }));
    node.dispatchEvent(new Event('change', { bubbles: true }));
  }
  return (
    <span className={styles.field} style={style} data-custom-select="">
      <CustomSelect
        id={fieldId}
        value={props.value !== undefined ? String(props.value) : selected}
        options={options.filter((option) => !option.hidden)}
        displayValue={
          options.find((option) => option.value === String(props.value ?? selected))?.label
        }
        disabled={props.disabled}
        popupMinWidth={popupMinWidth}
        onValueChange={choose}
        buttonProps={{
          ref: trigger,
          className: `${styles.control} ${className || ''}`,
          'aria-label': props['aria-label'],
          'aria-labelledby': props['aria-labelledby'],
          'aria-describedby': props['aria-describedby'],
          'aria-invalid': props['aria-invalid'],
          'aria-required': props.required || undefined,
          title: props.title,
          tabIndex: props.tabIndex,
          onFocus: () =>
            native.current?.dispatchEvent(new FocusEvent('focusin', { bubbles: true })),
          onBlur: () =>
            native.current?.dispatchEvent(new FocusEvent('focusout', { bubbles: true })),
        }}
      />
      <select
        {...props}
        ref={native}
        id={`${fieldId}-native`}
        aria-hidden="true"
        tabIndex={-1}
        className={styles.native}
        onFocus={(event) => {
          trigger.current?.focus({ preventScroll: true });
          onFocus?.(event);
        }}
        onBlur={onBlur}
        onChange={(event) => {
          setSelected(event.currentTarget.value);
          onChange?.(event);
        }}
      >
        {children}
      </select>
    </span>
  );
}
