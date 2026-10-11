"use client";

import type { ComponentProps } from "react";
import { CalendarDays } from "lucide-react";

type Props = Omit<ComponentProps<"input">, "type" | "value" | "onChange" | "readOnly"> & { value: string; onValueChange: (value: string) => void };

export function DatePicker({ value, onValueChange, className = "", placeholder = "Pilih tanggal", ...props }: Props) {
  function open(input: HTMLInputElement) {
    if (typeof input.showPicker !== "function") return false;
    try { input.showPicker(); return true; } catch { return false; }
  }
  return <div className="date-picker">
    <span className={`input date-picker-display ${!value ? "date-picker-empty" : ""}`} aria-hidden="true"><span>{value ? value.split("-").reverse().join("/") : placeholder}</span><CalendarDays size={18} /></span>
    <input {...props} className={`input date-picker-input ${className}`} type="date" inputMode="none" value={value} placeholder={placeholder}
      onChange={event => onValueChange(event.target.value)} onClick={event => { if (open(event.currentTarget)) event.preventDefault(); }}
      onKeyDown={event => {
        if (event.key === "Tab" || event.key === "Escape") return;
        if (["Enter", " ", "ArrowDown"].includes(event.key)) { if (open(event.currentTarget)) event.preventDefault(); }
        else event.preventDefault();
      }}
      onPaste={event => event.preventDefault()} onDrop={event => event.preventDefault()} />
  </div>;
}
