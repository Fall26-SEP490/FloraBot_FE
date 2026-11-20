import type { Locator, Page } from '@playwright/test';

type Choice = string | { value?: string; label?: string; index?: number };

/** Exercise the visible menu; keep native selection available for non-app controls. */
export async function chooseOption(control: Locator, choice: Choice): Promise<string[]> {
  let trigger = control;
  if (await control.evaluate((element) => element instanceof HTMLSelectElement)) {
    const wrapper = control.locator('xpath=ancestor::*[@data-custom-select][1]');
    if (!(await wrapper.count())) return control.selectOption(choice);
    trigger = wrapper.getByRole('combobox');
  }
  await trigger.click();
  const list = control.page().getByRole('listbox');
  const option =
    typeof choice === 'string' || choice.value !== undefined
      ? list.locator(
          `[role="option"][data-value=${JSON.stringify(typeof choice === 'string' ? choice : choice.value)}]`,
        )
      : choice.label !== undefined
        ? list.getByRole('option', { name: choice.label, exact: true })
        : list.getByRole('option').nth(choice.index ?? 0);
  const value = await option.getAttribute('data-value');
  await option.click();
  return value === null ? [] : [value];
}

export async function chooseSelect(scope: Page | Locator, label: string, value: string) {
  return chooseOption(scope.getByRole('combobox', { name: label, exact: true }), value);
}
