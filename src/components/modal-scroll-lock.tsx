"use client";

import { useEffect } from "react";

/** One document lock, shared by native dialogs and custom order forms. */
export function ModalScrollLock() {
  useEffect(() => {
    const body = document.body, root = document.documentElement;
    const baselineOverflow = body.style.overflow;
    let unlock: (() => void) | null = null;
    function sync() {
      const open = document.querySelector('dialog[open], [role="dialog"][aria-modal="true"]');
      if (open && !unlock) {
        const x = window.scrollX, y = window.scrollY;
        const saved = { position: body.style.position, top: body.style.top, left: body.style.left, width: body.style.width, rootOverflow: root.style.overflow, rootBehavior: root.style.scrollBehavior };
        body.style.position = "fixed";
        body.style.top = `${-y}px`;
        body.style.left = `${-x}px`;
        body.style.width = "100%";
        root.style.overflow = "hidden";
        unlock = () => {
          body.style.position = saved.position; body.style.top = saved.top;
          body.style.left = saved.left; body.style.width = saved.width;
          // Legacy dialog effects also set overflow; restore the unlocked document value.
          body.style.overflow = baselineOverflow;
          root.style.overflow = saved.rootOverflow;
          root.style.scrollBehavior = "auto";
          window.scrollTo(x, y);
          root.style.scrollBehavior = saved.rootBehavior;
        };
      } else if (!open && unlock) { unlock(); unlock = null; }
    }
    const observer = new MutationObserver(sync);
    observer.observe(body, { childList: true, subtree: true, attributes: true, attributeFilter: ["open", "role", "aria-modal"] });
    sync();
    return () => { observer.disconnect(); unlock?.(); };
  }, []);
  return null;
}
