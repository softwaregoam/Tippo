"use client";

import { useRef, useState } from "react";
import { BarChart3, Check, Crown, FileSpreadsheet, History, Package, ShoppingBag } from "lucide-react";
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
  const [paymentBusy,setPaymentBusy]=useState(false);
  const [checkoutBusy,setCheckoutBusy]=useState(false);
  const jastipUsed = monthlyOrderUsage(data, new Date(), "jastip");
  const poUsed = monthlyOrderUsage(data, new Date(), "po");
  const currentMonth = new Date(`${jakartaMonth()}-01T00:00:00+07:00`).toLocaleDateString("id-ID", { month: "long", year: "numeric", timeZone: "Asia/Jakarta" });
  const expiresLabel = subscription.expiresAt ? new Date(subscription.expiresAt).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }) : null;

  function activateDemo() {
    const saved = startProDemo();
    onNotify?.(saved ? "Demo Pro aktif selama satu bulan. Tidak ada pembayaran." : "Demo Pro aktif sementara. Pengaturan browser belum tersimpan.");
  }

  function returnToFree() {
    const saved = endProDemo();
    onNotify?.(saved ? "Paket Gratis aktif. Semua data lama tetap tersedia." : "Paket Gratis aktif sementara. Pengaturan browser belum tersimpan.");
  }

  const benefits = [
    { icon: ShoppingBag, title: "Pesanan tanpa batas", detail: "Jastip & Open PO" },
    { icon: Package, title: "Produk tanpa batas", detail: "Katalog Open PO" },
    { icon: BarChart3, title: "Laporan lengkap", detail: "Semua periode & ekspor Excel" },
    { icon: FileSpreadsheet, title: "Impor Excel", detail: "Produk & pesanan sekaligus" },
  ];
  const paymentHint = live
    ? proBilling ? plan === "pro" ? "Perpanjangan menambah masa Pro." : "Aktif otomatis setelah pembayaran."
      : sandbox ? "Pembayaran dalam mode uji." : "Pembayaran Pro belum tersedia."
    : "Demo lokal tanpa pembayaran.";

  return <div className="subscription-layout">
    <section className="card subscription-status" aria-label="Paket aktif">
      <div className="subscription-account-row">
        <div><h2>Paketmu: {plan === "pro" ? (live ? "Pro" : "Pro (demo)") : "Gratis"}</h2>
          <p>{plan === "pro" && expiresLabel ? `Aktif sampai ${expiresLabel} WIB` : `Kuota ${currentMonth}`}</p>
        </div>
        {live && account && <div className="subscription-tools"><Button className="btn btn-secondary" aria-label="Riwayat langganan" disabled={!proBilling} onClick={()=>paymentRef.current?.showHistory()}><History size={16} aria-hidden="true"/>Riwayat</Button></div>}
      </div>
      <div className="subscription-usage">
        <div><strong>{jastipUsed}{plan === "free" && <span> / {FREE_ORDER_LIMIT}</span>}</strong><span>Jastip</span></div>
        <div><strong>{poUsed}{plan === "free" && <span> / {FREE_ORDER_LIMIT}</span>}</strong><span>Open PO</span></div>
        <div><strong>{data.products.length}{plan === "free" && <span> / {FREE_PRODUCT_LIMIT}</span>}</strong><span>Produk PO</span></div>
      </div>
      {plan === "free" && subscription.tier === "pro" && <p className="subscription-expiry">Masa Pro berakhir. Paket Gratis aktif.</p>}
    </section>

    <div className="subscription-plans">
      <section id="tippo-pro-plan" tabIndex={-1} className="card subscription-plan pro-plan" aria-label="Paket Pro">
        <div className="subscription-pro-heading"><div className="subscription-plan-title"><Crown size={23} aria-hidden="true"/><h2>Pro</h2></div><span className="subscription-saving">Hemat 50%</span></div>
        <h3 className="subscription-pro-headline">Lebih leluasa, usaha makin ramai.</h3>
        <div className="subscription-pro-offer">
          <div><s className="subscription-original-price" aria-label="Harga sebelumnya Rp50.000">Rp50.000</s><p className="subscription-price">Rp{PRO_MONTHLY_PRICE.toLocaleString("id-ID")}<span> / bulan</span></p></div>
          <div className="subscription-cta">
            {live?<Button className="btn btn-primary subscription-upgrade" disabled={!proBilling || !account || paymentBusy} onClick={()=>void paymentRef.current?.upgrade()}><Crown size={16} aria-hidden="true"/>{checkoutBusy?"Menyiapkan pembayaran…":plan==="pro"?"Perpanjang Pro · Rp25.000":"Upgrade ke Pro · Rp25.000"}</Button>:plan === "pro" ? <span className="status-tag">Demo Pro aktif</span> : <Button className="btn btn-primary" onClick={activateDemo}><Crown size={16} aria-hidden="true"/>Coba Pro (demo)</Button>}
            <p className="field-hint">{paymentHint}</p>
          </div>
        </div>
        <ul className="subscription-pro-benefits">{benefits.map(({icon:Icon,title,detail})=><li key={title}><span className="subscription-benefit-icon"><Icon size={20} aria-hidden="true"/></span><div><strong>{title}</strong><span>{detail}</span></div></li>)}</ul>
        <p className="subscription-included"><Check size={15} aria-hidden="true"/>Semua fitur Gratis sudah termasuk.</p>
      </section>
      <section className="card subscription-plan free-plan" aria-label="Paket Gratis">
        <div className="subscription-free-heading"><h2>Gratis</h2>{plan === "free" && <span className="status-tag">Paket aktif</span>}</div>
        <p className="subscription-price">Rp0<span> / bulan</span></p>
        <ul className="subscription-features">
          <li><Check size={16} aria-hidden="true"/><span>{FREE_ORDER_LIMIT} pesanan per usaha / bulan</span></li>
          <li><Check size={16} aria-hidden="true"/><span>{FREE_PRODUCT_LIMIT} produk Open PO</span></li>
          <li><Check size={16} aria-hidden="true"/><span>Invoice gambar & WhatsApp</span></li>
          <li><Check size={16} aria-hidden="true"/><span>HPP, margin & rekap Excel</span></li>
        </ul>
        <p className="field-hint">Kuota pesanan diperbarui tiap bulan.</p>
        {plan === "pro" && !live && <Button className="btn btn-secondary" onClick={returnToFree}>Kembali ke Gratis</Button>}
      </section>
    </div>
    {live && account && process.env.NEXT_PUBLIC_DOKU_PRODUCTION_TEST_ENABLED==="true" && <DokuSandboxPanel key={account.id+"-production-test"} account={account} mode="production-test"/>}
    {live && account && (proBilling?<DokuSandboxPanel key={account.id+"-pro"} account={account} mode="production" onSubscriptionChanged={onSubscriptionChanged} paymentRef={paymentRef} onBusyChange={setPaymentBusy} onCheckoutBusyChange={setCheckoutBusy}/>:sandbox?<DokuSandboxPanel key={account.id} account={account}/>:null)}
  </div>;
}
