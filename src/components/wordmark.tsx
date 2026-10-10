import Link from "next/link";
export function Wordmark({ dark = false }: { dark?: boolean }) {
  return <Link href="/" className={`wordmark ${dark ? "wordmark-light" : ""}`} aria-label="Tippo, halaman utama">Tippo<span>.</span></Link>;
}
