export const AFTER_SAVE_EVENT = "tippo:after-save";

/** Wait for dialog cleanup to finish before resetting the mobile page. */
export function scrollToTopAfterSave() {
  if (window.matchMedia("(max-width: 760px)").matches) {
    window.dispatchEvent(new Event(AFTER_SAVE_EVENT));
  }
}
