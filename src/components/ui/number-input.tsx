"use client";

import { useEffect, useRef, type ComponentProps } from "react";
import { formatNumberInput, parseNumberInput } from "@/lib/number-input";

type Props = Omit<ComponentProps<"input">, "value" | "onChange" | "type"> & {
  value: string;
  onValueChange: (value: string) => void;
};

export function NumberInput({ value, onValueChange, ...props }: Props) {
  const frame = useRef<number | null>(null);
  useEffect(() => () => { if (frame.current !== null) cancelAnimationFrame(frame.current); }, []);
  return <input {...props} type="text" inputMode="numeric" value={formatNumberInput(value)} onChange={(event) => {
    const input = event.currentTarget;
    const native = event.nativeEvent as InputEvent;
    const editing = /^\d+$/.test(value) && (native.inputType?.startsWith("delete") || (native.inputType === "insertText" && /^\d+$/.test(native.data ?? "")));
    const raw = parseNumberInput(input.value, Boolean(editing));
    const digitsBefore = input.value.slice(0, input.selectionStart ?? input.value.length).replaceAll(".", "").length;
    onValueChange(raw);
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      if (document.activeElement !== input || !/^\d*$/.test(raw)) return;
      const display = formatNumberInput(raw);
      let position = 0;
      let count = 0;
      while (position < display.length && count < digitsBefore) { if (display[position] !== ".") count++; position++; }
      input.setSelectionRange(position, position);
    });
  }} />;
}
