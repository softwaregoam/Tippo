export function formatNumberInput(value: string): string {
  return /^\d+$/.test(value) ? value.replace(/\B(?=(\d{3})+(?!\d))/g, ".") : value;
}

export function parseNumberInput(value: string, editingFormatted = false): string {
  if ((editingFormatted && /^[\d.]*$/.test(value)) || /^\d{1,3}(?:\.\d{3})+$/.test(value)) return value.replaceAll(".", "");
  return value;
}
