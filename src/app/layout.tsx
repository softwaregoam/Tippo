import type { Metadata } from "next";
import { ModalScrollLock } from "@/components/modal-scroll-lock";
import "./globals.css";
import "@fontsource/plus-jakarta-sans/latin-400.css";
import "@fontsource/plus-jakarta-sans/latin-500.css";
import "@fontsource/plus-jakarta-sans/latin-600.css";
import "@fontsource/plus-jakarta-sans/latin-700.css";
import "@fontsource/plus-jakarta-sans/latin-800.css";
import "./website.css";
import "./landing.css";
import "./auth.css";
import "./theme.css";

export const metadata: Metadata = {
  title: "Tippo: Jastip & Open PO",
  icons: { icon: [{ url: "/icon.svg?v=tippo-2", type: "image/svg+xml", sizes: "any" }], shortcut: "/icon.svg?v=tippo-2", apple: [{ url: "/brands/tippo-apple.png", sizes: "1254x1254", type: "image/png" }] },
  description: "Titip & Pesan, Beres di Tippo. Kelola Jastip dan Open PO, rekap belanja, hitung HPP dan margin, bagikan invoice, serta unduh laporan.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: `try{document.documentElement.dataset.theme=localStorage.getItem("tippo.theme.v1")==="dark"?"dark":"light"}catch{}` }} /></head>
      <body><ModalScrollLock />{children}</body>
    </html>
  );
}
