/** Shared vector artwork keeps the approved bag, T and check clear at small sizes. */
export function TippoLogo() {
  return <span className="tippo-logo" aria-hidden="true">
    <svg className="tippo-logo-symbol" viewBox="-2 -2 104 108" width="40" height="42" fill="none" focusable="false">
      <path fill="currentColor" fillRule="evenodd" d="M25 27v-2a25 25 0 0 1 50 0v2h-8v-2a17 17 0 0 0-34 0v2Z M18 27h64a10 10 0 0 1 10 9l8 55a11 11 0 0 1-11 13H11A11 11 0 0 1 0 91l8-55a10 10 0 0 1 10-9Z M27 43a3 3 0 0 0-3 3v8a3 3 0 0 0 3 3h12v34a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V57h12a3 3 0 0 0 3-3v-8a3 3 0 0 0-3-3Z"/>
      <path className="tippo-logo-accent" d="m65 82 9 9 16-21" stroke="currentColor" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
    <span className="tippo-logo-word">Tippo<span className="tippo-logo-accent">.</span></span>
  </span>;
}
