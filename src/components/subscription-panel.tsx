"use client";

import { useRef, useState } from "react";
import { Check, Crown, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DokuSandboxPanel, type ProPaymentControls } from "@/components/doku-sandbox-panel";
import {
  effectivePlan, endProDemo, FREE_ORDER_LIMIT, FREE_PRODUCT_LIMIT, jakartaMonth,
  monthlyOrderUsage, PRO_MONTHLY_PRICE, startProDemo,
} from "@/lib/subscription";
import type { Subscription } from "@/lib/subscription";
import type { AppData } from "@/lib/types";

interface SubscriptionPanelProps {
  data: AppData;
  subscription: Subscription;
  account?: { id: string; name: string; email: string };
  onNotify?: (message: string) => void;
  onSubscriptionChanged?:()=>Promise<void>;
}

export function SubscriptionPanel({ data, subscription, account, onNotify, onSubscriptionChanged }: SubscriptionPanelProps) {
  const plan = effectivePlan(subscription);
  const live = subscription.mode === "live";
  const sandbox = process.env.NEXT_PUBLIC_DOKU_SANDBOX_ENABLED === "true";
  const proBilling=process.env.NEXT_PUBLIC_DOKU_PRO_ENABLED==="true";
  const paymentRef=useRef<ProPaymentControls|null>(null);
  const [paymentBusy,setPaymentBusy]=useState(true);
  const jastipUsed = monthlyOrderUsage(data, new Date(), "jastip");
  const poUsed = monthlyOrderUsage(data, new Date(), "po");
  const currentMonth = new Date(`${jakartaMonth()}-01T00:00:00+07:00`).toLocaleDateString("id-ID", { month: "long", year: "numeric", timeZone: "Asia/Jakarta" });
  const expiresLabel = subscription.expiresAt ? new Date(subscription.expiresAt).toLocaleString("id-ID", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }) : null;

  function activateDemo() {
    const saved = startProDemo();
    onNotify?.(saved ? "Demo Pro aktif selama satu bulan. Tidak ada pembayaran." : "Demo Pro aktif sementara. Pengaturan browser belum tersimpan.");
  }

  function returnToFree() {
    const saved = endProDemo();
    onNotify?.(saved ? "Paket Gratis aktif. Semua data lama tetap tersedia." : "Paket Gratis aktif sementara. Pengaturan browser belum tersimpan.");
  }

  return <div className="subscription-layout">
    {live && account && <div className="subscription-tools"><Button className="btn btn-secondary" disabled={!proBilling || paymentBusy} onClick={()=>paymentRef.current?.showHistory()}><History size={17}/>Riwayat langganan</Button></div>}
    <section className="card subscription-status" aria-label="Paket aktif">
      <div className="card-header"><div><h2>Paketmu: {plan === "pro" ? (live ? "Pro" : "Pro (demo)") : "Gratis"}</h2><p>Periode kuota {currentMonth} · waktu Jakarta</p></div><span className="type-badge">{plan === "pro" ? (live ? "PRO" : "PRO DEMO") : "GRATIS"}</span></div>
      <div className="subscription-usage">
        <div><strong>{jastipUsed}{plan === "free" ? ` / ${FREE_ORDER_LIMIT}` : ""}</strong><span>Pesanan Jastip bulan ini</span><small>Satu pesanan boleh berisi banyak produk.</small></div>
        <div><strong>{poUsed}{plan === "free" ? ` / ${FREE_ORDER_LIMIT}` : ""}</strong><span>Pesanan Open PO bulan ini</span><small>Kuota PO terpisah dari kuota Jastip.</small></div>
        <div><strong>{data.products.length}{plan === "free" ? ` / ${FREE_PRODUCT_LIMIT}` : ""}</strong><span>Produk master PO</span><small>Produk yang diarsipkan tetap termasuk batas produk.</small></div>
      </div>
      {plan === "pro" && expiresLabel && <p className="subscription-expiry">{live ? "Pro" : "Demo Pro"} aktif sampai {expiresLabel} WIB.</p>}
      {plan === "free" && subscription.tier === "pro" && <p className="subscription-expiry">Masa {live ? "Pro" : "demo Pro"} berakhir. Paket Gratis berlaku kembali dan data lama tersimpan.</p>}
    </section>

    <div className="subscription-plans">
      <section className="card subscription-plan" aria-label="Paket Gratis">
        <div className="subscription-plan-title"><h2>Gratis</h2></div>
        <p className="subscription-price">Rp0<span> / bulan</span></p>
        <ul className="subscription-features">
          <li><Check size={16} /><span>{FREE_ORDER_LIMIT} pesanan Jastip dan {FREE_ORDER_LIMIT} pesanan Open PO per bulan</span></li>
          <li><Check size={16} /><span>Maksimal {FREE_PRODUCT_LIMIT} produk master Open PO</span></li>
          <li><Check size={16} /><span>Ringkasan bulan berjalan</span></li>
          <li><Check size={16} /><span>Banyak produk per pesanan dan invoice WhatsApp</span></li>
        </ul>
        <p className="field-hint">Kuota pesanan kembali tersedia setiap tanggal 1 pukul 00.00 WIB. Pesanan yang dibatalkan tetap terhitung.</p>
        {plan === "pro" && !live ? <Button className="btn btn-secondary" onClick={returnToFree}>Kembali ke Gratis</Button> : plan === "free" ? <span className="status-tag">Paket aktif</span> : null}
      </section>
      <section id="tippo-pro-plan" tabIndex={-1} className="card subscription-plan pro-plan" aria-label="Paket Pro">
        <div className="subscription-plan-title"><Crown size={23} /><h2>Pro</h2></div>
        <p className="subscription-price"><s className="subscription-original-price" aria-label="Harga sebelumnya Rp50.000">Rp50.000</s>Rp{PRO_MONTHLY_PRICE.toLocaleString("id-ID")}<span> / bulan</span></p>
        <ul className="subscription-features">
          <li><Check size={16} /><span>Pesanan Jastip dan PO tanpa batas kuota</span></li>
          <li><Check size={16} /><span>Produk master Open PO tanpa batas kuota</span></li>
          <li><Check size={16} /><span>Ringkasan dan grafik bulan sebelumnya</span></li>
          <li><Check size={16} /><span>Template dan import Excel produk, Jastip, dan Open PO</span></li>
          <li><Check size={16} /><span>Semua fitur paket Gratis</span></li>
        </ul>
        <p className="field-hint">{live ? proBilling?"Bayar melalui DOKU Checkout. Pro aktif setelah pembayaran terverifikasi; riwayat invoice tersimpan di akunmu.":sandbox ? "Pembayaran DOKU tersedia untuk pengujian sandbox. Paket akun produksi tidak berubah setelah simulasi." : "Pembayaran Pro sedang disiapkan. Paket Gratis tetap bisa digunakan; kami belum menerima pembayaran langganan." : "Pembayaran langganan belum tersedia pada prototipe ini. Tombol di bawah mengaktifkan demo lokal selama satu bulan tanpa biaya."}</p>
        {live?<Button className="btn btn-primary subscription-upgrade" disabled={!proBilling || !account || paymentBusy} onClick={()=>void paymentRef.current?.upgrade()}><Crown size={16}/>{proBilling && paymentBusy?"Memuat pembayaran…":plan==="pro"?"Perpanjang Pro · Rp25.000":"Upgrade ke Pro · Rp25.000"}</Button>:plan === "pro" ? <span className="status-tag">Demo Pro aktif</span> : <Button className="btn btn-primary" onClick={activateDemo}><Crown size={16} />Coba Pro (demo)</Button>}
      </section>
    </div>
    {live && account && process.env.NEXT_PUBLIC_DOKU_PRODUCTION_TEST_ENABLED==="true" && <DokuSandboxPanel key={account.id+"-production-test"} account={account} mode="production-test"/>}
    {live && account && (proBilling?<DokuSandboxPanel key={account.id+"-pro"} account={account} mode="production" onSubscriptionChanged={onSubscriptionChanged} paymentRef={paymentRef} onBusyChange={setPaymentBusy}/>:sandbox?<DokuSandboxPanel key={account.id} account={account}/>:null)}
  </div>;
}
