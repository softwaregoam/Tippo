/** Localized decimals: a dot groups thousands, a comma separates up to six decimals. */
const editable = /^(?:[0-9]{1,12}|[0-9]{1,3}(?:\.[0-9]{3}){1,3})(?:,[0-9]{0,6})?$/;
export function formatDecimalInput(value: string): string {
  if (!editable.test(value)) return value;
  const [whole, fraction] = value.replaceAll(".", "").split(",");
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + (fraction === undefined ? "" : `,${fraction}`);
}
export function editDecimalInput(previous: string, next: string, inputType?: string, data?: string | null): string {
  // Typed edits include grouping inserted by us. Pasted malformed decimals stay
  // invalid, so a decimal dot cannot silently turn a price into thousands.
  if (editable.test(previous) && (inputType?.startsWith("delete") || inputType === "insertText" && /^[0-9,]+$/.test(data ?? ""))) return next.replaceAll(".", "");
  return next;
}
