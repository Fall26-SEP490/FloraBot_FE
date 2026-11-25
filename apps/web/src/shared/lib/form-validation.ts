import { vietnamDateTimeToUtc } from './vietnam-date';

type Field = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
export function fieldValidationMessage(field: Field): string {
  if (
    field.matches(':disabled, [readonly]') ||
    (field instanceof HTMLInputElement &&
      ['hidden', 'submit', 'button', 'reset'].includes(field.type))
  )
    return '';
  const value = field.value.trim();
  const validity = field.validity;
  if (
    field.required &&
    (!value ||
      (field instanceof HTMLInputElement && field.type === 'checkbox' && !field.checked) ||
      (field instanceof HTMLInputElement && field.type === 'radio' && validity.valueMissing))
  )
    return field instanceof HTMLInputElement && field.type === 'checkbox'
      ? 'Vui lòng đánh dấu xác nhận.'
      : 'Vui lòng nhập hoặc chọn thông tin này.';
  if (validity.badInput) return 'Nhập giá trị hợp lệ.';
  if (!value) return '';
  if (field.dataset.vnKind) {
    try {
      if (field.dataset.vnKind === 'time') {
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return 'Chọn giờ hợp lệ.';
      } else if (field.dataset.vnKind === 'month') {
        vietnamDateTimeToUtc(`${value}-01T00:00`);
      } else {
        vietnamDateTimeToUtc(field.dataset.vnKind === 'date' ? `${value}T00:00` : value);
      }
    } catch {
      return 'Chọn ngày và giờ hợp lệ.';
    }
    if (field.dataset.min && value < field.dataset.min)
      return 'Ngày hoặc giờ đã chọn sớm hơn giới hạn cho phép.';
    if (field.dataset.max && value > field.dataset.max)
      return 'Ngày hoặc giờ đã chọn muộn hơn giới hạn cho phép.';
  }
  const minLength = 'minLength' in field ? field.minLength : -1;
  const maxLength = 'maxLength' in field ? field.maxLength : -1;
  if (minLength > 0 && value.length < minLength) return `Nhập ít nhất ${minLength} ký tự.`;
  if (maxLength > 0 && value.length > maxLength) return `Nhập tối đa ${maxLength} ký tự.`;
  if (validity.typeMismatch)
    return field instanceof HTMLInputElement && field.type === 'email'
      ? 'Nhập địa chỉ email hợp lệ.'
      : 'Thông tin chưa đúng định dạng.';
  if (validity.rangeUnderflow) return `Giá trị tối thiểu là ${(field as HTMLInputElement).min}.`;
  if (validity.rangeOverflow) return `Giá trị tối đa là ${(field as HTMLInputElement).max}.`;
  if (validity.stepMismatch) return 'Giá trị chưa đúng bước cho phép.';
  if (validity.patternMismatch)
    return field.dataset.validationMessage || 'Thông tin chưa đúng định dạng.';
  if (validity.customError) return field.dataset.validationMessage || 'Kiểm tra lại thông tin này.';
  return '';
}

/** Shared native constraint feedback; business validators keep handling their own rules. */
export function installFormValidation(root: HTMLElement): () => void {
  // Forms may still be hydrating inside streamed route boundaries. Do not mutate
  // their validation attributes; handle native invalid events and submit instead.
  const observer = new MutationObserver(() => {
    for (const field of messages.keys()) {
      if (!root.contains(field)) clear(field);
    }
  });
  observer.observe(root, { childList: true, subtree: true });
  const messages = new Map<
    Field,
    {
      node: HTMLParagraphElement;
      described: string | null;
      invalid: string | null;
      trigger?: HTMLElement | null;
      triggerDescribed?: string | null;
      triggerInvalid?: string | null;
    }
  >();
  let serial = 0;
  function clear(field: Field) {
    const entry = messages.get(field);
    if (!entry) return;
    entry.node.remove();
    if (entry.described) field.setAttribute('aria-describedby', entry.described);
    else field.removeAttribute('aria-describedby');
    if (entry.invalid) field.setAttribute('aria-invalid', entry.invalid);
    else field.removeAttribute('aria-invalid');
    if (entry.trigger) {
      if (entry.triggerDescribed)
        entry.trigger.setAttribute('aria-describedby', entry.triggerDescribed);
      else entry.trigger.removeAttribute('aria-describedby');
      if (entry.triggerInvalid) entry.trigger.setAttribute('aria-invalid', entry.triggerInvalid);
      else entry.trigger.removeAttribute('aria-invalid');
    }
    messages.delete(field);
  }
  function show(field: Field, message: string) {
    clear(field);
    if (!message) return;
    const node = document.createElement('p');
    node.id = `form-field-error-${++serial}`;
    node.className = 'form-field-error';
    node.setAttribute('role', 'alert');
    node.textContent = message;
    const described = field.getAttribute('aria-describedby');
    const invalid = field.getAttribute('aria-invalid');
    field.setAttribute('aria-invalid', 'true');
    field.setAttribute('aria-describedby', [described, node.id].filter(Boolean).join(' '));
    const trigger = field
      .closest('[data-vietnam-date], [data-custom-select]')
      ?.querySelector<HTMLElement>('button');
    const triggerDescribed = trigger?.getAttribute('aria-describedby');
    const triggerInvalid = trigger?.getAttribute('aria-invalid');
    trigger?.setAttribute('aria-invalid', 'true');
    trigger?.setAttribute(
      'aria-describedby',
      [triggerDescribed, node.id].filter(Boolean).join(' '),
    );
    const anchor =
      field.closest('label') ?? field.closest('[data-vietnam-date], [data-custom-select]') ?? field;
    anchor.insertAdjacentElement('afterend', node);
    messages.set(field, { node, described, invalid, trigger, triggerDescribed, triggerInvalid });
  }
  function isField(value: EventTarget | null): value is Field {
    return (
      value instanceof HTMLInputElement ||
      value instanceof HTMLTextAreaElement ||
      value instanceof HTMLSelectElement
    );
  }
  function invalid(event: Event) {
    if (!isField(event.target)) return;
    event.preventDefault();
    show(event.target, fieldValidationMessage(event.target));
    if (!firstInvalid) firstInvalid = event.target;
    if (!invalidFrame)
      invalidFrame = requestAnimationFrame(() => {
        const field = firstInvalid;
        firstInvalid = undefined;
        invalidFrame = 0;
        if (!field || !root.contains(field)) return;
        const focus =
          field
            .closest('[data-vietnam-date], [data-custom-select]')
            ?.querySelector<HTMLElement>('button') ?? field;
        focus.focus({ preventScroll: true });
        focus.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      });
  }
  function submit(event: Event) {
    if (!(event.target instanceof HTMLFormElement)) return;
    if (
      event instanceof SubmitEvent &&
      (event.submitter instanceof HTMLButtonElement ||
        event.submitter instanceof HTMLInputElement) &&
      event.submitter.formNoValidate
    )
      return;
    const form = event.target;
    let first: Field | undefined;
    for (const field of Array.from(form.elements)) {
      if (!isField(field)) continue;
      const message = fieldValidationMessage(field);
      show(field, message);
      if (message && !first) first = field;
    }
    if (!first) return;
    event.preventDefault();
    event.stopPropagation();
    const focus =
      first
        .closest('[data-vietnam-date], [data-custom-select]')
        ?.querySelector<HTMLElement>('button') ?? first;
    focus.focus({ preventScroll: true });
    focus.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  function edit(event: Event) {
    if (isField(event.target)) clear(event.target);
  }
  let firstInvalid: Field | undefined;
  let invalidFrame = 0;
  root.addEventListener('invalid', invalid, true);
  root.addEventListener('submit', submit, true);
  root.addEventListener('input', edit, true);
  root.addEventListener('change', edit, true);
  return () => {
    observer.disconnect();
    cancelAnimationFrame(invalidFrame);
    root.removeEventListener('invalid', invalid, true);
    root.removeEventListener('submit', submit, true);
    root.removeEventListener('input', edit, true);
    root.removeEventListener('change', edit, true);
    for (const field of messages.keys()) clear(field);
  };
}
