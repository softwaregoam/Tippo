"use client";

import { useImperativeHandle, useRef, useState, type ComponentProps, type ReactNode, type Ref } from "react";
import { Select as SelectPrimitive } from "radix-ui";
import { Check, ChevronDown } from "lucide-react";

type SelectProps = Omit<ComponentProps<"button">, "value" | "onChange" | "ref"> & {
  placeholder?: string;
  value: string;
  onValueChange: (value: string) => void;
  ref?: Ref<HTMLButtonElement>;
};

export function Select({ placeholder, value, onValueChange, children, className = "", disabled, name, ref, ...props }: SelectProps) {
  const trigger = useRef<HTMLButtonElement>(null);
  const closingTap = useRef(false);
  const [open, setOpen] = useState(false);
  const [container, setContainer] = useState<HTMLElement>();
  useImperativeHandle(ref, () => trigger.current!);

  return <SelectPrimitive.Root value={placeholder && !value ? "" : `value:${value}`} onValueChange={(next) => onValueChange(next.slice(6))} disabled={disabled} open={open} onOpenChange={(next) => { if (next) setContainer(trigger.current?.closest("dialog") ?? undefined); setOpen(next); }}>
    <SelectPrimitive.Trigger {...props} ref={trigger} name={name} className={`select-trigger ${className}`} data-value={value}
      style={{ ...props.style, ...(open ? { pointerEvents: "auto" } : {}) }}
      onPointerDownCapture={(event) => {
        props.onPointerDownCapture?.(event);
        closingTap.current = open;
      }}
      onPointerDown={(event) => {
        props.onPointerDown?.(event);
        if (closingTap.current) {
          event.preventDefault();
          setOpen(false);
        }
      }}
      onClick={(event) => {
        props.onClick?.(event);
        if (closingTap.current) {
          event.preventDefault();
          closingTap.current = false;
          setOpen(false);
        }
      }}
      onKeyDown={(event) => {
        closingTap.current = false;
        props.onKeyDown?.(event);
      }}>
      <SelectPrimitive.Value placeholder={placeholder} />
      <SelectPrimitive.Icon><ChevronDown size={16} aria-hidden="true" /></SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
    <SelectPrimitive.Portal container={container}>
      <SelectPrimitive.Content className="select-content" position="popper" sideOffset={6} collisionPadding={12}>
        <SelectPrimitive.Viewport>{children}</SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
    {name && <input type="hidden" name={name} value={value} disabled={disabled} />}
  </SelectPrimitive.Root>;
}

export function SelectOption({ value, children, disabled }: { value: string; children: ReactNode; disabled?: boolean }) {
  return <SelectPrimitive.Item className="select-option" value={`value:${value}`} data-value={value} disabled={disabled}>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    <SelectPrimitive.ItemIndicator><Check size={16} aria-hidden="true" /></SelectPrimitive.ItemIndicator>
  </SelectPrimitive.Item>;
}
