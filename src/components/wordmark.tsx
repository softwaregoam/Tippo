import Link from "next/link";
import { TippoLogo } from "./tippo-logo";
export function Wordmark({ dark = false }: { dark?: boolean }) {
  return <Link href="/" className={`wordmark ${dark ? "wordmark-light" : ""}`} aria-label="Tippo, halaman utama"><TippoLogo /></Link>;
}
