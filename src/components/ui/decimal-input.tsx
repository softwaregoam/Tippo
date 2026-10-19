"use client";
import { useEffect, useRef, type ComponentProps } from "react";
import { editDecimalInput, formatDecimalInput } from "@/lib/decimal-input";

type Props = Omit<ComponentProps<"input">, "value" | "onChange" | "type"> & { value: string; onValueChange: (value: string) => void };
export function DecimalInput({value,onValueChange,...props}:Props) {
  const frame=useRef<number|null>(null);
  useEffect(()=>()=>{if(frame.current!==null)cancelAnimationFrame(frame.current);},[]);
  return <input {...props} type="text" inputMode="decimal" value={formatDecimalInput(value)} onChange={event=>{
    const input=event.currentTarget,native=event.nativeEvent as InputEvent;
    const before=input.value.slice(0,input.selectionStart??input.value.length).replaceAll(".","").length;
    const next=editDecimalInput(value,input.value,native.inputType,native.data);
    onValueChange(next);
    if(frame.current!==null)cancelAnimationFrame(frame.current);
    frame.current=requestAnimationFrame(()=>{
      if(document.activeElement!==input)return;
      const display=formatDecimalInput(next);let position=0,count=0;
      while(position<display.length&&count<before){if(display[position]!==".")count++;position++;}
      input.setSelectionRange(position,position);
    });
  }}/>;
}
