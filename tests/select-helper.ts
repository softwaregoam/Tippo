import { expect, type Locator } from "@playwright/test";

export async function chooseOption(trigger: Locator, value: string | { label: string }) {
  await trigger.click();
  const page = trigger.page();
  const option = typeof value === "string"
    ? page.locator(`[role="option"][data-value=${JSON.stringify(value)}]`)
    : page.getByRole("option", { name: value.label, exact: true });
  await option.click();
}

export async function expectSelectOptions(trigger: Locator, name: string | RegExp, count: number) {
  await trigger.click();
  await expect(trigger.page().getByRole("option", { name })).toHaveCount(count);
  await trigger.page().keyboard.press("Escape");
}
