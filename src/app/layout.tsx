import type { Metadata } from "next";
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
  description: "Titip & Pesan, Beres di Tippo. Kelola jastip dan open PO, catat pesanan, hitung HPP, serta salin invoice.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: `try{document.documentElement.dataset.theme=localStorage.getItem("tippo.theme.v1")==="dark"?"dark":"light"}catch{}` }} /></head>
      <body>{children}</body>
    </html>
  );
}
