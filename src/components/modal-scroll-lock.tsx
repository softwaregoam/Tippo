"use client";

import { useEffect } from "react";
import { AFTER_SAVE_EVENT } from "@/lib/after-save";

/** One document lock, shared by dialogs, order forms and mobile navigation. */
export function ModalScrollLock() {
  useEffect(() => {
    const body = document.body, root = document.documentElement;
    const baselineOverflow = body.style.overflow;
    let unlock: (() => void) | null = null;
    let pendingTop = false, frame = 0;
    const openOverlay = () => document.querySelector('dialog[open], [role="dialog"][aria-modal="true"], [data-scroll-lock="true"]');
    const mobile = () => window.matchMedia("(max-width: 760px)").matches;
    function finishSave() {
      frame = 0;
      if (!pendingTop || openOverlay()) return;
      pendingTop = false;
      if (!mobile()) return;
      const behavior = root.style.scrollBehavior;
      root.style.scrollBehavior = "auto";
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
      root.style.scrollBehavior = behavior;
    }
    function sync() {
      const open = openOverlay();
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
          window.scrollTo(pendingTop && mobile() ? 0 : x, pendingTop && mobile() ? 0 : y);
          root.style.scrollBehavior = saved.rootBehavior;
        };
      } else if (!open && unlock) { unlock(); unlock = null; }
      if (!open && pendingTop && !frame) {
        // Native dialogs and React effect cleanup can restore focus after unlock.
        frame = requestAnimationFrame(() => { frame = requestAnimationFrame(finishSave); });
      }
    }
    function afterSave() { if (mobile()) { pendingTop = true; sync(); } }
    const observer = new MutationObserver(sync);
    observer.observe(body, { childList: true, subtree: true, attributes: true, attributeFilter: ["open", "role", "aria-modal", "data-scroll-lock"] });
    window.addEventListener(AFTER_SAVE_EVENT, afterSave);
    sync();
    return () => { observer.disconnect(); window.removeEventListener(AFTER_SAVE_EVENT, afterSave); cancelAnimationFrame(frame); pendingTop = false; unlock?.(); };
  }, []);
  return null;
}
