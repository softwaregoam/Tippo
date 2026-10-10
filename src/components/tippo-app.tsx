"use client";

import { canChangeBatchStatus } from "@/lib/batch-status";
import { isAppData } from "@/lib/validation";
import { applyRefund, refundedTotal } from "@/lib/refund";
import { BusinessProfilePanel } from "@/components/business-profile";
import { ThemeToggle } from "@/components/theme-toggle";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  ArrowRight, ArrowUpRight, CalendarDays, Crown,
  Check, ChevronDown, CircleHelp, Download, FileJson, Layers3,
  LayoutDashboard, LogOut, MapPin, Menu, Package, Pencil, Plus, ReceiptText, Search, Settings2,
  ShoppingBag, Upload, UsersRound, Wallet, X,
} from "lucide-react";
import { Select, SelectOption } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { OrderForm } from "@/components/order-form";
import { PoOrderForm } from "@/components/po-order-form";
import { ModeWorkspace } from "@/components/mode-workspace";
import {MobileDataList} from "@/components/mobile-data-list";
import { OrdersTable } from "@/components/orders-table";
import { HppPanel } from "@/components/hpp-panel";
import { SubscriptionPanel } from "@/components/subscription-panel";
import { useAppData, saveAppData, normalizeAppData } from "@/lib/store";
import { seedData } from "@/lib/seed";
import { formatCurrency, getMonthlySeries, getMonthSummary, outstanding } from "@/lib/finance";
import { canCreateOrders, canCreateProduct, canRestoreOrders, effectivePlan, jakartaMonth, monthlyOrderUsage, recordOrderUsage, useSubscription } from "@/lib/subscription";
import type { AppData, Batch, Customer, Order, Product } from "@/lib/types";
import type { AccountWorkspace } from "./cloud-workspace";
import Link from "next/link";

type Page = "dashboard" | "orders" | "products" | "batches" | "hpp" | "customers" | "settings" | "profile" | "subscription";
const businessModeKey = "tippo.business-mode.v1";
const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const subtitles = {
  dashboard: "Cek penjualan, HPP, dan sisa tagihan usaha ini.",
  orders: "Catat pesanan, pembayaran, dan perkembangan pengiriman.",
  products: "Katalog produk sendiri, harga siap untuk pesanan berikutnya.",
  batches: "Kelompokkan pesanan sesuai perjalanan atau periode PO.",
  hpp: "Kenali biaya sebenarnya, tentukan harga dengan percaya diri.",
  customers: "Kontak dipakai bersama. Jumlah pesanan mengikuti usaha yang dipilih.",
  profile: "Nama dan kontak usaha dalam satu tempat.",
  settings: "Simpan cadangan data Jastip dan Open PO dalam akun ini.",
  subscription: "Pilih ruang yang sesuai untuk usaha yang terus tumbuh.",
};
const shortMoney = (n: number) => n >= 1000000 ? `${(n / 1000000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jt` : n >= 1000 ? `${Math.round(n / 1000)} rb` : `${n}`;
const monthLabel = (month: string) => `${monthNames[Number(month.slice(5)) - 1]} ${month.slice(0, 4)}`;
const dateLabel = (date: string) => new Date(`${date}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
const sampleOrderIds = new Set(seedData.orders.map((order) => order.id));
const subscribeReady = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

export function TippoApp({ cloud }: { cloud?: AccountWorkspace }) {
  const ready = useSyncExternalStore(subscribeReady, clientReady, serverReady);
  const demoData = useAppData();
  const data = cloud?.record.data ?? demoData;
  const demoSubscription = useSubscription();
  const subscription = cloud?.record.subscription ?? demoSubscription;
  const isPro = effectivePlan(subscription) === "pro";
  const currentMonth = jakartaMonth();
  const [mode, setMode] = useState<Batch["type"]>(() => {
    try { return typeof window !== "undefined" && localStorage.getItem(businessModeKey) === "po" ? "po" : "jastip"; }
    catch { return "jastip"; }
  });
  const modeLabel = mode === "po" ? "Open PO" : "Jastip";
  const titles: Record<Page, string> = { dashboard: `Ringkasan ${modeLabel}`, orders: `Pesanan ${modeLabel}`, products: "Produk Open PO", batches: mode === "po" ? "Batch PO" : "Perjalanan Jastip", hpp: `HPP & Margin ${modeLabel}`, customers: "Pelanggan", settings: "Pengaturan data", profile: "Profil bisnis", subscription: "Paket & langganan" };
  const navigation = [
    { id: "dashboard" as Page, label: "Ringkasan", icon: LayoutDashboard },
    ...(mode === "po" ? [{ id: "products" as Page, label: "Produk", icon: Package }] : []),
    { id: "batches" as Page, label: mode === "po" ? "Batch PO" : "Perjalanan", icon: Layers3 },
    { id: "orders" as Page, label: "Pesanan", icon: ReceiptText },
    { id: "hpp" as Page, label: "HPP & Margin", icon: Wallet },
    { id: "customers" as Page, label: "Pelanggan", icon: UsersRound },
    { id: "settings" as Page, label: "Pengaturan data", icon: Settings2 },
  ];
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [page, setPage] = useState<Page>("dashboard");
  const [selectedMonth, setMonth] = useState(() => jakartaMonth());
  const month = isPro ? selectedMonth : currentMonth;
  const [search, setSearch] = useState("");
  const [orderModal, setOrderModal] = useState<{ type: Batch["type"]; order?: Order; batchId?: string; productId?: string } | null>(null);
  const [batchModal, setBatchModal] = useState<{ type: Batch["type"]; batch?: Batch } | null>(null);
  const [poWorkspaceVersion, setPoWorkspaceVersion] = useState(0);
  const [customerModal, setCustomerModal] = useState<Customer | "new" | null>(null);
  const [selectedHpp, setSelectedHpp] = useState("batch-korea-oct");
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigationRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const accountButton = useRef<HTMLButtonElement>(null);
  const focusLastAccountItem = useRef(false);
  const [saveError, setSaveError] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    document.documentElement.dataset.businessMode = mode;
    return () => { delete document.documentElement.dataset.businessMode; };
  }, [mode]);

  useEffect(() => {
    if (!accountOpen) return;
    const items = accountRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)');
    items?.[focusLastAccountItem.current ? items.length - 1 : 0]?.focus();
    function outside(event: PointerEvent) {
      if (!accountRef.current?.contains(event.target as Node)) setAccountOpen(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault(); setAccountOpen(false); accountButton.current?.focus();
    }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [accountOpen]);

  useEffect(() => {
    if (!mobileOpen) return;
    const sidebar = navigationRef.current;
    const opener = menuRef.current;
    const focusFrame = requestAnimationFrame(() => sidebar?.querySelector<HTMLButtonElement>("button")?.focus());
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); setMobileOpen(false); }
      if (event.key !== "Tab" || !sidebar) return;
      const controls = Array.from(sidebar.querySelectorAll<HTMLElement>("button:not(:disabled), a[href]"));
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", handleKey);
    const handleResize = () => { if (window.matchMedia("(min-width: 761px)").matches) setMobileOpen(false); };
    window.addEventListener("resize", handleResize);
    return () => { cancelAnimationFrame(focusFrame); document.removeEventListener("keydown", handleKey); window.removeEventListener("resize", handleResize); opener?.focus(); };
  }, [mobileOpen]);

  function notify(message: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(null), 4500);
  }
  async function persist(next: AppData, message: string) {
    setSaveError("");
    const invalidBatch = next.batches.find(batch => {
      const current = data.batches.find(entry => entry.id === batch.id);
      return current && !canChangeBatchStatus(current.status, batch.status);
    });
    if (invalidBatch) {
      const error = "Status batch hanya dapat berubah dari Dibuka ke Ditutup, lalu Selesai. Perubahan tidak bisa dibatalkan.";
      setSaveError(error); notify(error); return false;
    }
    try {
      if (cloud) { const saved = await cloud.commit(next); if (saved) notify(message); return saved; }
      const previousUsageSaved = recordOrderUsage(data.orders.filter((order) => !sampleOrderIds.has(order.id)), data.batches);
      const saved = saveAppData(next);
      const usageSaved = recordOrderUsage(next.orders.filter((order) => !sampleOrderIds.has(order.id)), next.batches);
      notify(saved && previousUsageSaved && usageSaved ? message : "Perubahan sementara: penyimpanan browser tidak tersedia. Ekspor data sebelum menutup.");
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Data belum tersimpan.";
      setSaveError(message); notify(message);
      return false;
    }
  }
  function go(next: Page) { setSaveError(""); setPage(next); setSearch(""); setMobileOpen(false); setAccountOpen(false); }
  function switchMode(next: Batch["type"]) {
    if (next === mode) return;
    setMode(next);
    try { localStorage.setItem(businessModeKey, next); } catch { /* Switching still works without browser storage. */ }
    setSelectedHpp("");
    go("dashboard");
  }
  async function saveOrder(order: Order, customer?: Customer) {
    const existing = data.orders.find((entry) => entry.id === order.id);
    if (!existing) {
      const type = data.batches.find((batch) => batch.id === order.batchId)?.type;
      const quota = canCreateOrders(data, subscription, 1, new Date(), type);
      if (!quota.allowed) { notify(quota.message); return; }
    }
    const savedOrder = { ...order, refunds: existing?.refunds ?? order.refunds, createdAt: existing?.createdAt ?? new Date().toISOString() };
    const next = { ...data, customers: customer ? [customer, ...data.customers] : data.customers, orders: existing ? data.orders.map((o) => o.id === order.id ? savedOrder : o) : [savedOrder, ...data.orders] };
    if (await persist(next, !orderModal?.order ? "Pesanan baru berhasil dicatat" : "Pesanan berhasil diperbarui")) setOrderModal(null);
  }
  function updateStatus(order: Order, status: Order["status"]) {
    if (status === "cancelled" && order.paid > 0) { notify("Pesanan yang sudah dibayar belum dapat dibatalkan. Catat refund seluruh pembayaran sebelum membatalkan."); return; }
    persist({ ...data, orders: data.orders.map((o) => o.id === order.id ? { ...o, status } : o) }, "Status pesanan diperbarui");
  }
  const modeBatches = data.batches.filter(batch => batch.type === mode);
  const modeBatchIds = new Set(modeBatches.map(batch => batch.id));
  const modeOrders = data.orders.filter(order => modeBatchIds.has(order.batchId));
  const summaryData = { ...data, batches: modeBatches, orders: modeOrders };
  const summary = getMonthSummary(summaryData, month);
  const currentYear = Number(month.slice(0, 4));
  const availableYears = Array.from(new Set([2026, currentYear, new Date().getFullYear(), ...modeOrders.map((o) => Number(o.date.slice(0, 4)))] )).sort();
  const monthOrders = modeOrders.filter((o) => o.date.startsWith(month)).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const unpaidOrders = monthOrders.filter((order) => outstanding(order) > 0);
  const activeBatches = modeBatches.filter((b) => b.status === "open");
  const visibleCustomers = data.customers.filter((customer) => customer.name.toLowerCase().includes(search.toLowerCase()));
  const hppBatch = modeBatches.find((b) => b.id === selectedHpp) ?? modeBatches[0];
  const hasDemoData = data.orders.some((order) => seedData.orders.some((sample) => sample.id === order.id));
  function startOrder(type: Batch["type"] = mode, batchId?: string, productId?: string) {
    setSaveError("");
    const quota = canCreateOrders(data, subscription, 1, new Date(), type);
    if (!quota.allowed) { go("subscription"); notify(quota.message); return; }
    if (!data.batches.some((batch) => batch.type === type && batch.status === "open")) {
      setBatchModal({ type });
      notify(`Buat batch ${type === "po" ? "PO" : "jastip"} aktif terlebih dahulu.`);
      return;
    }
    if (type === "po" && !data.products.some((product) => product.active)) {
      go("products"); setPoWorkspaceVersion((value) => value + 1);
      notify("Tambahkan produk aktif ke master sebelum mencatat pesanan PO.");
      return;
    }
    setOrderModal({ type, batchId, productId });
  }
  function editOrder(order: Order) {
    setSaveError("");
    const type = data.batches.find((batch) => batch.id === order.batchId)?.type;
    if (type) setOrderModal({ type, order });
  }
  async function refundOrder(id: string, amount: number, date: string, reason: string, cancel: boolean) {
    const order = data.orders.find(entry => entry.id === id);
    if (!order) throw new Error("Pesanan tidak ditemukan. Muat ulang data.");
    const next = applyRefund(order, amount, date, reason, cancel);
    const updated={...data,orders:data.orders.map(entry=>entry.id===id?next:entry)};
    if (!isAppData(updated)) throw new Error("Data refund tidak valid atau nominal gabungan terlalu besar.");
    return persist(updated, "Refund berhasil dicatat");
  }
  async function saveProduct(product: Product) {
    if (!data.products.some((existing) => existing.id === product.id)) {
      const quota = canCreateProduct(data, subscription);
      if (!quota.allowed) { notify(quota.message); return false; }
    }
    if (product.sku && data.products.some((p) => p.id !== product.id && p.sku.toLowerCase() === product.sku.toLowerCase())) {
      notify("SKU sudah digunakan produk lain. Gunakan SKU yang unik."); return false;
    }
    return persist({ ...data, products: data.products.some((p) => p.id === product.id) ? data.products.map((p) => p.id === product.id ? product : p) : [product, ...data.products] }, "Master produk tersimpan. Harga pesanan lama tetap sama.");
  }
  async function importProducts(products: Product[]) {
    if (effectivePlan(subscription) !== "pro") throw new Error("Import template Excel hanya tersedia untuk paket Pro.");
    const quota = canCreateProduct(data, subscription);
    if (!quota.allowed) throw new Error(quota.message);
    if (products.length > quota.remaining) throw new Error("Paket Gratis maksimal 5 produk, termasuk arsip. Kurangi baris atau upgrade Pro.");
    return persist({ ...data, products: [...products, ...data.products] }, `${products.length} produk berhasil diimpor dari Excel`);
  }
  async function importOrders(orders: Order[], customers: Customer[]) {
    if (effectivePlan(subscription) !== "pro") throw new Error("Import template Excel hanya tersedia untuk paket Pro.");
    const type = data.batches.find((batch) => batch.id === orders[0]?.batchId)?.type;
    const quota = canCreateOrders(data, subscription, orders.length, new Date(), type);
    if (!quota.allowed) throw new Error(quota.message);
    const createdAt = new Date().toISOString();
    return persist({ ...data, orders: [...orders.map((order) => ({ ...order, createdAt })), ...data.orders], customers: [...customers, ...data.customers] }, `${orders.length} pesanan berhasil diimpor dari Excel`);
  }
  function replaceData(next: AppData, message: string) {
    const quota = canRestoreOrders(data, next, subscription);
    if (!quota.allowed) { notify(quota.message); return; }
    const oldProductIds = new Set(data.products.map((product) => product.id));
    if (!isPro && next.products.length > 5 && next.products.some((product) => !oldProductIds.has(product.id))) {
      notify("Paket Gratis maksimal 5 produk PO. Upgrade Pro untuk memulihkan katalog ini."); return;
    }
    persist(next, message);
  }

  if (!ready) return <div className="app-loading" role="status">Memuat workspace Tippo…</div>;

  return (
    <div className={`app-shell ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      {mobileOpen && <button className="sidebar-scrim" aria-label="Tutup navigasi" onClick={() => setMobileOpen(false)} />}
      <aside ref={navigationRef} id="workspace-navigation" className={`sidebar ${mobileOpen ? "is-open" : ""}`}>
        <button className="icon-button sidebar-close" aria-label="Tutup navigasi" onClick={() => setMobileOpen(false)}><X size={20} /></button>
        <div className="sidebar-heading"><button className="brand" onClick={() => go("dashboard")} aria-label="Tippo, halaman ringkasan"><span>Tippo<span className="brand-dot">.</span></span></button><button className="icon-button sidebar-toggle" aria-label={sidebarCollapsed ? "Perluas sidebar" : "Minimalkan sidebar"} aria-expanded={!sidebarCollapsed} aria-controls="workspace-navigation" onClick={() => setSidebarCollapsed(!sidebarCollapsed)}><Menu size={20} aria-hidden="true" /></button></div>
        <p className="brand-caption">Titip &amp; Pesan, Beres di Tippo.</p>
        <div className="workspace-label">Menu {modeLabel}</div>
        <nav aria-label="Navigasi utama">
          {navigation.map(({ id, label, icon: Icon }) => <button key={id} aria-label={label} title={sidebarCollapsed ? label : undefined} aria-current={page === id ? "page" : undefined} className={`nav-item ${page === id ? "active" : ""}`} onClick={() => go(id)}><Icon size={19} /><span>{label}</span></button>)}
        </nav>
        <div className="sidebar-bottom"><button aria-label="Paket & langganan" title={sidebarCollapsed ? "Paket & langganan" : undefined} className={`nav-item ${page === "subscription" ? "active" : ""}`} aria-current={page === "subscription" ? "page" : undefined} onClick={() => go("subscription")}><Crown size={19} /><span>Paket & langganan</span></button>
          <button className="help-link" aria-label="Butuh panduan?" title={sidebarCollapsed ? "Butuh panduan?" : undefined} onClick={() => { go("settings"); notify("Panduan: buat batch → catat pesanan → lengkapi HPP → ekspor data secara rutin."); }}><CircleHelp size={17} /><span>Butuh panduan?</span></button>
        </div>
      </aside>

      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb"><button ref={menuRef} className="icon-button mobile-menu" aria-label="Buka navigasi" aria-expanded={mobileOpen} aria-controls="workspace-navigation" onClick={() => setMobileOpen(true)}><Menu size={21} /><span>Menu</span></button><span>Halaman</span><span className="breadcrumb-slash">/</span><strong>{titles[page]}</strong></div>
          <div className="topbar-right"><button className={`plan-pill ${isPro ? "is-pro" : ""}`} onClick={() => go("subscription")}>{isPro ? (cloud ? "Pro" : "Pro (demo)") : "Gratis"}</button>
            <div className="account-control" ref={accountRef} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setAccountOpen(false); }}>
              <button ref={accountButton} className="top-avatar" aria-label="Menu akun" aria-haspopup="menu" aria-expanded={accountOpen} aria-controls="account-menu" onClick={() => { focusLastAccountItem.current = false; setAccountOpen(!accountOpen); }} onKeyDown={(event) => { if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); focusLastAccountItem.current = event.key === "ArrowUp"; setAccountOpen(true); } }}><span>Akun</span><ChevronDown size={14} aria-hidden="true" /></button>
              {accountOpen && <div id="account-menu" className="account-dropdown" role="menu" aria-label="Menu akun" onKeyDown={(event) => {
                if (event.key === "Tab") { setTimeout(() => setAccountOpen(false), 0); return; }
                const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)'));
                const index = items.indexOf(document.activeElement as HTMLElement);
                const next = event.key === "ArrowDown" ? (index + 1) % items.length : event.key === "ArrowUp" ? (index + items.length - 1) % items.length : event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : -1;
                if (next >= 0) { event.preventDefault(); items[next]?.focus(); }
              }}>
                <div className="account-menu-identity" role="presentation"><strong>{cloud?.name ?? "Usaha kamu"}</strong><span>{cloud?.email || "Mode demo"}</span></div>
                <button role="menuitem" tabIndex={-1} onClick={() => { go("profile"); accountButton.current?.focus(); }}><UsersRound size={18} aria-hidden="true" />Profil bisnis</button>
                <ThemeToggle menu />
                {cloud ? <button role="menuitem" tabIndex={-1} className="account-logout" disabled={cloud.saving} onClick={() => { setAccountOpen(false); accountButton.current?.focus(); void cloud.logout(); }}><LogOut size={18} aria-hidden="true" />Keluar</button> : <Link role="menuitem" tabIndex={-1} className="account-logout" href="/" onKeyDown={(event) => { if (event.key === " ") { event.preventDefault(); event.currentTarget.click(); } }}><LogOut size={18} aria-hidden="true" />Keluar demo</Link>}
              </div>}
            </div>
          </div>
        </header>
        <main className="main-content">
          <div className="business-switch" role="group" aria-label="Pilih usaha">
            <button type="button" aria-pressed={mode === "jastip"} onClick={() => switchMode("jastip")}><ShoppingBag size={18} aria-hidden="true" />Jastip</button>
            <button type="button" aria-pressed={mode === "po"} onClick={() => switchMode("po")}><Package size={18} aria-hidden="true" />Open PO</button>
          </div>
          <div className="page-heading"><div><div className="eyebrow">{hasDemoData ? "DATA CONTOH · MODE DEMO" : modeLabel.toUpperCase()}</div><h1>{titles[page]}<span className="heading-dot">.</span></h1><p>{subtitles[page]}</p></div>{page !== "hpp" && <div className="heading-actions">{page === "dashboard" && <div className="month-picker"><CalendarDays size={16} /><Select aria-label="Pilih bulan ringkasan" disabled={!isPro} value={month} onValueChange={(value) => setMonth(value)}>{(isPro ? availableYears.flatMap((year) => monthNames.map((name, i) => <SelectOption key={`${year}-${i}`} value={`${year}-${String(i + 1).padStart(2, "0")}`}>{name} {year}</SelectOption>)) : [<SelectOption key={currentMonth} value={currentMonth}>{monthLabel(currentMonth)}</SelectOption>])}</Select></div>}{page === "customers" && <Button className="btn btn-primary" onClick={() => { setSaveError(""); setCustomerModal("new"); }}><Plus size={17} />Tambah pelanggan</Button>}{page === "orders" && <Button className="btn btn-primary" onClick={() => startOrder()}><Plus size={17} />{mode === "po" ? "Pesanan PO baru" : "Pesanan jastip baru"}</Button>}</div>}</div>

          {!isPro && <div className="quota-banner"><div><strong>{modeLabel} {monthlyOrderUsage(data, new Date(), mode)} / 5 pesanan bulan ini</strong><span>Reset awal bulan · satu pesanan boleh banyak barang</span></div><Button className="btn btn-secondary" onClick={() => go("subscription")}><Crown size={15} />Upgrade Pro</Button></div>}
            <div key={page}>
              {page === "dashboard" && <>
                <div className="stats-grid">
                  <Stat title="Total penjualan" value={formatCurrency(summary.revenue)} note={`${summary.ordersCount} pesanan di ${monthNames[Number(month.slice(5)) - 1]}`} />
                  <Stat title="Estimasi margin" value={formatCurrency(summary.profit)} note={summary.unknownCostCount ? `${summary.unknownCostCount} pesanan belum lengkap HPP` : "Estimasi laba kotor, sebelum biaya umum"} warning={summary.unknownCostCount > 0} />
                  <Stat title="Pesanan bulan ini" value={`${summary.ordersCount}`} note={`${monthOrders.filter((o) => o.status === "done").length} selesai · ${monthOrders.filter((o) => !["done", "cancelled"].includes(o.status)).length} dalam proses`} />
                  <Stat title="Sisa tagihan" value={formatCurrency(summary.outstanding)} note="Piutang pesanan bulan terpilih" />
                </div>
                <div className="dashboard-middle">
                  <section className="card chart-card"><div className="card-header"><div><h2>Penjualan dibanding HPP</h2><p>{isPro ? "Perbandingan enam bulan, berdasarkan tanggal pesanan." : "Perbandingan pada bulan berjalan."}</p></div><div className="chart-year">{currentYear}</div></div><div className="chart-summary"><div><span>{isPro ? "Total penjualan tahun ini" : `Penjualan ${monthLabel(month)}`}</span><strong>{formatCurrency(isPro ? getMonthlySeries(summaryData, currentYear).reduce((sum, point) => sum + point.revenue, 0) : summary.revenue)}</strong></div><div className="chart-legend"><span><i className="legend-dot teal" />Penjualan</span><span><i className="legend-dot gold" />HPP diketahui</span></div></div><MonthlyChart data={summaryData} month={month} currentOnly={!isPro} />{!isPro && <button className="summary-upgrade" onClick={() => go("subscription")}><Crown size={14} />Ringkasan bulan sebelumnya tersedia di Pro</button>}<div className="chart-caption"><span>Berdasarkan tanggal pesanan</span><span>HPP yang belum terisi tidak dihitung</span></div></section>
                  <div className="dashboard-payments">
                    <section className="card payments-card"><div className="card-header"><div><h2>Aliran pembayaran</h2><p>Untuk pesanan {monthLabel(month)}</p></div></div><div className="payment-overview"><PaymentDonut received={summary.received} total={summary.revenue} /><div className="payment-breakdown"><div><span><i className="legend-dot teal" />Sudah diterima</span><strong>{formatCurrency(summary.received)}</strong></div><div><span><i className="legend-dot pale" />Belum dibayar</span><strong>{formatCurrency(summary.outstanding)}</strong></div>{modeOrders.some(o=>o.date.startsWith(`${month}-`) && refundedTotal(o)>0) && <div><span>Refund pesanan bulan ini</span><strong>{formatCurrency(modeOrders.filter(o=>o.date.startsWith(`${month}-`)).reduce((sum,o)=>sum+refundedTotal(o),0))}</strong></div>}</div></div></section>
                    <section className="card unpaid-card" aria-labelledby="unpaid-title">
                      <div className="card-header"><div><h2 id="unpaid-title">Tagihan belum lunas</h2><p>{monthLabel(month)} · {unpaidOrders.length} pesanan</p></div></div>
                      {unpaidOrders.length > 0 ? <>
                        <ul className="unpaid-list">{unpaidOrders.slice(0, 5).map(order => <li key={order.id}>
                          <div><h3>{data.customers.find(customer => customer.id === order.customerId)?.name || "Pelanggan belum diisi"}</h3><p>{data.batches.find(batch => batch.id === order.batchId)?.name || "Batch belum diisi"} · {dateLabel(order.date)}</p></div>
                          <strong>{formatCurrency(outstanding(order))}</strong>
                        </li>)}</ul>
                        <div className="unpaid-total"><span>Total sisa tagihan</span><strong>{formatCurrency(summary.outstanding)}</strong></div>
                        {unpaidOrders.length > 5 && <p className="unpaid-limit">Menampilkan 5 dari {unpaidOrders.length} tagihan terbaru.</p>}
                      </> : <div className="unpaid-empty">{summary.ordersCount > 0 && <Check size={20} aria-hidden="true" />}<p>{summary.ordersCount > 0 ? "Semua tagihan bulan ini sudah lunas." : "Belum ada tagihan bulan ini."}</p></div>}
                    </section>
                  </div>
                </div>
                <section className="batch-preview"><div className="section-heading"><div><h2>{mode === "po" ? "Batch PO aktif" : "Perjalanan aktif"} <span className="count-pill">{activeBatches.length}</span></h2><p>Jangan sampai ada pesanan yang terlewat.</p></div></div><div className="batch-preview-grid">{activeBatches.length ? activeBatches.map((batch, index) => <BatchCard key={batch.id} batch={batch} data={data} index={index} onOpen={() => { setSelectedHpp(batch.id); go("hpp"); }} />) : <div className="empty-state compact"><Layers3 size={28} /><p>{mode === "po" ? "Belum ada batch PO aktif." : "Belum ada perjalanan aktif."}</p><Button className="btn btn-secondary" onClick={() => setBatchModal({ type: mode })}>{mode === "po" ? "Buat batch PO" : "Buat perjalanan"}</Button></div>}<button className="new-batch-card" onClick={() => setBatchModal({ type: mode })}><span><Plus size={22} /></span><strong>{mode === "po" ? "Batch PO baru" : "Perjalanan baru"}</strong><p>{mode === "po" ? "Buka periode pesanan berikutnya" : "Siapkan perjalanan belanja berikutnya"}</p></button></div></section>
                <section className="card recent-card"><div className="card-header"><div><h2>Pesanan terbaru</h2><p>Yang baru masuk, langsung tercatat.</p></div></div><OrdersTable data={data} orders={monthOrders.slice(0, 5)} onEdit={editOrder} onStatus={updateStatus} onRefund={refundOrder} compact readOnly /></section>
                <div className="page-footnote"><span>{hasDemoData ? "Ringkasan ini memuat data contoh." : "Ringkasan dihitung dari pesanan yang kamu simpan."}</span><button onClick={() => go("settings")}>Kelola dan ekspor data</button></div>
              </>}


              {(page === "products" || page === "batches" || page === "orders") && <ModeWorkspace key={mode + page + poWorkspaceVersion} tab={page} type={mode} data={data}
                onNewBatch={() => setBatchModal({ type: mode })}
                onEditBatch={(batch) => setBatchModal({ type: batch.type, batch })}
                onNewOrder={(batchId, productId) => startOrder(mode, batchId, productId)}
                onEditOrder={editOrder} onStatus={updateStatus} onRefund={refundOrder}
                onBatchStatus={(batch, status) => persist({ ...data, batches: data.batches.map((b) => b.id === batch.id ? { ...b, status } : b) }, "Status batch diperbarui")}
                onHpp={(batch) => { setSelectedHpp(batch.id); go("hpp"); }}
                onSaveProduct={saveProduct} onImportProducts={importProducts}
                onProductStatus={(product) => persist({ ...data, products: data.products.map((p) => p.id === product.id ? { ...p, active: !p.active } : p) }, product.active ? "Produk diarsipkan. Histori pesanan tetap tersedia." : "Produk aktif kembali")}
                onImport={importOrders} importAllowed={isPro} productLimit={!isPro ? 5 : undefined} onUpgrade={() => go("subscription")}
              />}

              {page === "hpp" && <><div className="hpp-notice"><div className="notice-icon"><Wallet size={21} /></div><div><strong>Lengkapi harga beli barang.</strong><p>HPP dihitung dari harga beli per barang dan jumlahnya. Harga beli yang belum diisi ditandai agar estimasi margin dapat diperiksa.</p></div></div>{hppBatch ? <><div className="hpp-selector"><span className="field-label">Pilih batch</span><Select className="input" aria-label="Pilih batch untuk HPP" value={hppBatch.id} onValueChange={(value) => setSelectedHpp(value)}>{modeBatches.map((b) => <SelectOption value={b.id} key={b.id}>{b.name}</SelectOption>)}</Select></div><HppPanel key={hppBatch.id + JSON.stringify(data.orders.filter((o) => o.batchId === hppBatch.id).map((o) => [o.id, o.items.map((item) => [item.id, item.unitCost])])) + hppBatch.directCosts} batch={hppBatch} data={data} onSave={(next) => persist(next, "Biaya tersimpan. HPP dan margin sudah diperbarui.")} /></> : <Empty title="HPP dimulai dari batch" description="Buat batch dan catat pesanan agar biaya bisa dihitung." action="Buat batch" onAction={() => setBatchModal({ type: mode })} />}</>}

              {page === "customers" && <section className="card"><div className="list-toolbar"><div className="search-field"><Search size={18} /><input aria-label="Cari pelanggan" placeholder="Cari nama pelanggan..." value={search} onChange={(e) => setSearch(e.target.value)} /></div><span className="muted">{visibleCustomers.length} pelanggan</span></div>{visibleCustomers.length > 0 && <><MobileDataList entries={visibleCustomers.map(c=>({id:c.id,title:c.name,subtitle:c.phone||"WhatsApp belum diisi",meta:`${modeOrders.filter(o=>o.customerId===c.id&&o.status!=="cancelled").length} pesanan`,details:<><dl className="mobile-detail-fields"><dt>WhatsApp</dt><dd>{c.phone||"Belum diisi"}</dd><dt>Alamat</dt><dd>{c.address||"Belum diisi"}</dd></dl><button data-close-detail className="btn btn-primary" onClick={()=>{setSaveError("");setCustomerModal(c);}}>Edit pelanggan</button></>}))}/><div className="management-table-wrap desktop-data-table"><table className="management-table" aria-label="Daftar pelanggan"><thead><tr><th scope="col">Nama pelanggan</th><th scope="col">WhatsApp</th><th scope="col">Alamat</th><th scope="col" className="numeric">Jumlah pesanan</th><th scope="col">Aksi</th></tr></thead><tbody>{visibleCustomers.map(customer=><tr key={customer.id}><td data-label="Nama pelanggan"><h3>{customer.name}</h3></td><td data-label="WhatsApp">{customer.phone || "Belum diisi"}</td><td data-label="Alamat" className="customer-address-cell">{customer.address || "Belum diisi"}</td><td data-label="Jumlah pesanan" className="numeric">{modeOrders.filter(o=>o.customerId===customer.id && o.status!=="cancelled").length}</td><td data-label="Aksi"><button className="icon-button" aria-label={`Edit pelanggan ${customer.name}`} onClick={()=>{setSaveError("");setCustomerModal(customer);}}><Pencil size={16}/></button></td></tr>)}</tbody></table></div></>}{!data.customers.length ? <Empty title="Pelanggan pertamamu akan muncul di sini" description="Simpan nama dan nomor pelanggan sebelum mencatat pesanan." action="Tambah pelanggan" onAction={() => { setSaveError(""); setCustomerModal("new"); }} /> : !visibleCustomers.length && <div className="empty-state"><h3>Pelanggan tidak ditemukan</h3><p>Coba nama lain atau kosongkan pencarian untuk melihat semua pelanggan.</p><Button className="btn btn-secondary" onClick={() => setSearch("")}>Reset pencarian</Button></div>}</section>}

              {page === "subscription" && <SubscriptionPanel data={data} subscription={subscription} onNotify={notify} />}

              {page === "profile" && <BusinessProfilePanel cloud={cloud} onNotify={notify} />}
              {page === "settings" && <DataSettings data={data} cloud={!!cloud} onUpdate={replaceData} onNotify={notify} />}
            </div>
        </main>
      </div>
      {orderModal && (orderModal.type === "po" ? <PoOrderForm saving={cloud?.saving} saveError={saveError} data={data} order={orderModal.order} onSave={saveOrder} onClose={() => setOrderModal(null)} /> : <OrderForm saving={cloud?.saving} saveError={saveError} data={data} order={orderModal.order} defaultBatchId={orderModal.batchId} onSave={saveOrder} onClose={() => setOrderModal(null)} />)}
      {batchModal && <BatchForm type={batchModal.type} batch={batchModal.batch} onSave={async (batch) => { if (await persist({ ...data, batches: data.batches.some((b) => b.id === batch.id) ? data.batches.map((b) => b.id === batch.id ? batch : b) : [batch, ...data.batches] }, "Batch berhasil disimpan")) setBatchModal(null); }} onClose={() => setBatchModal(null)} />}
      {customerModal && <CustomerForm customer={customerModal === "new" ? undefined : customerModal} onClose={() => setCustomerModal(null)} onSave={async (customer) => {
        const exists = data.customers.some((entry) => entry.id === customer.id);
        const saved = await persist({ ...data, customers: exists ? data.customers.map((entry) => entry.id === customer.id ? customer : entry) : [customer, ...data.customers] }, exists ? "Pelanggan berhasil diperbarui" : "Pelanggan berhasil ditambahkan");
        if (saved) { setCustomerModal(null); setSearch(""); }
        return saved;
      }} />}
      {toast && <div role="status" className="toast"><Check size={18} /><span>{toast}</span><button aria-label="Tutup pemberitahuan" onClick={() => setToast(null)}><X size={16} /></button></div>}
    </div>
  );
}

function Stat({ title, value, note, warning }: { title: string; value: string; note: string; warning?: boolean }) {
  return <section className="card stat-card"><div className="stat-top"><span>{title}</span></div><strong className="stat-value">{value}</strong><div className={`stat-note ${warning ? "warning" : ""}`}>{note}</div></section>;
}

function MonthlyChart({ data, month, currentOnly = false }: { data: AppData; month: string; currentOnly?: boolean }) {
  const series = getMonthlySeries(data, Number(month.slice(0, 4)));
  const end = Math.max(5, Number(month.slice(5)) - 1);
  const points = series.slice(end - 5, end + 1);
  const [hover, setHover] = useState<number | null>(null);
  if (currentOnly) {
    const summary = getMonthSummary(data, month);
    const maxCurrent = Math.max(1, summary.revenue, summary.hpp);
    return <div className="current-month-chart" role="img" aria-label={`Grafik ${monthLabel(month)}, penjualan ${formatCurrency(summary.revenue)}, HPP diketahui ${formatCurrency(summary.hpp)}`}><div className="current-bars">{[{ label: "Penjualan", value: summary.revenue, tone: "teal" }, { label: "HPP diketahui", value: summary.hpp, tone: "gold" }].map((bar) => <div key={bar.label}><strong>{formatCurrency(bar.value)}</strong><div className="current-bar-track"><span className={bar.tone} style={{ height: `${Math.max(bar.value ? 4 : 0, bar.value / maxCurrent * 100)}%` }} /></div><span>{bar.label}</span></div>)}</div><p>{monthLabel(month)}</p></div>;
  }
  const max = Math.max(1000000, ...points.map((p) => p.revenue), ...points.map((p) => p.hpp)) * 1.18;
  const left = 60, right = 654, top = 16, bottom = 190;
  const x = (i: number) => left + i * (right - left) / 5;
  const y = (amount: number) => bottom - amount / max * (bottom - top);
  const line = (key: "revenue" | "hpp") => points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p[key])}`).join(" ");
  const focus = hover ?? Number(month.slice(5)) - 1 - (end - 5);
  return <div className="monthly-chart">
    <svg viewBox="0 0 680 232" role="img" aria-label={`Grafik penjualan dan HPP diketahui: ${points.map((p) => `${p.label}, penjualan ${formatCurrency(p.revenue)}, HPP ${formatCurrency(p.hpp)}`).join("; ")}`}>
      {[0, 1, 2, 3, 4].map((i) => { const value = max * i / 4; return <g key={i}><line x1={left} x2={right} y1={y(value)} y2={y(value)} stroke="var(--border)" strokeDasharray={i ? "4 5" : undefined} /><text x={left - 14} y={y(value) + 4} textAnchor="end" fill="var(--muted)" fontSize="12">{shortMoney(value)}</text></g>; })}
      <path d={line("hpp")} fill="none" stroke="var(--chart-cost, var(--warning))" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="5 5" />
      <path d={line("revenue")} fill="none" stroke="var(--primary)" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => <g key={p.month} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}><text x={x(i)} y={bottom + 27} textAnchor="middle" fill={i === focus ? "var(--primary)" : "var(--muted)"} fontSize="12" fontWeight={i === focus ? "600" : "400"}>{p.label}</text><circle cx={x(i)} cy={y(p.revenue)} r={i === focus ? 5 : 3} fill="var(--canvas)" stroke="var(--primary)" strokeWidth="2" /><rect x={x(i) - 24} y={top} width="48" height={bottom - top} fill="transparent" /></g>)}
    </svg>
    <div className="chart-month-controls" role="group" aria-label="Pilih bulan pada grafik">{points.map((point,i) => <button key={point.month} aria-pressed={i === focus} onClick={() => setHover(i)} onFocus={() => setHover(i)}>{point.label}</button>)}</div>
    <p className="chart-selected-value" aria-live="polite">{points[focus].label}: penjualan {formatCurrency(points[focus].revenue)}, HPP diketahui {formatCurrency(points[focus].hpp)}.</p>
  </div>;
}

function PaymentDonut({ received, total }: { received: number; total: number }) {
  const percent = total > 0 ? Math.round(received / total * 100) : 0;
  return <div className="donut-wrap"><div className="donut-chart"><svg viewBox="0 0 180 180" role="img" aria-label={`${percent}% tagihan telah dibayar`}><circle cx="90" cy="90" r="76" fill="none" stroke="var(--border)" strokeWidth="15" /><circle cx="90" cy="90" r="76" fill="none" stroke="var(--primary)" strokeWidth="15" strokeLinecap="round" strokeDasharray={`${percent / 100 * 477.52} 477.52`} transform="rotate(-90 90 90)" /></svg><div className="donut-label"><strong>{percent}<small>%</small></strong></div></div><span className="donut-caption">Sudah dibayar</span></div>;
}

function BatchCard({ batch, data, index, onOpen }: { batch: Batch; data: AppData; index: number; onOpen: () => void }) {
  const orders = data.orders.filter((o) => o.batchId === batch.id && o.status !== "cancelled");
  const ready = orders.filter((o) => ["ready", "shipped", "done"].includes(o.status)).length;
  return <button className="batch-card" onClick={onOpen}><div className="batch-card-top"><span className={`batch-icon ${index % 2 ? "peach" : "mint"}`}>{batch.type === "jastip" ? <ShoppingBag size={22} /> : <Package size={22} />}</span><span className={`type-badge ${batch.type === "po" ? "type-po" : ""}`}>{batch.type === "po" ? "OPEN PO" : "JASTIP"}</span><ArrowUpRight size={17} className="batch-open-icon" /></div><h3>{batch.name}</h3><p><MapPin size={13} />{batch.origin || "Lokasi belum ditentukan"}</p><div className="batch-progress"><span style={{ width: `${orders.length ? ready / orders.length * 100 : 0}%` }} /></div><div className="batch-card-foot"><span><strong>{orders.length}</strong> pesanan · {ready} siap</span><span><CalendarDays size={12} />{dateLabel(batch.closeDate)}</span></div></button>;
}

function Empty({ title, description, action, onAction }: { title: string; description: string; action: string; onAction: () => void }) {
  return <div className="empty-state"><div className="empty-icon"><ShoppingBag size={26} /></div><h3>{title}</h3><p>{description}</p><Button className="btn btn-primary" onClick={onAction}>{action}</Button></div>;
}

function SimpleModal({ title, subtitle, onClose, children }: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const shown = useCallback((element: HTMLDialogElement | null) => {
    if (!element) dialog.current?.close();
    else if (!element.open) {
      element.showModal();
      element.querySelector<HTMLElement>('input:not(:disabled):not([type="hidden"]), select:not(:disabled), textarea:not(:disabled)')?.focus();
    }
    dialog.current = element;
  }, []);
  return <dialog ref={shown} className="native-dialog" onCancel={(e) => { e.preventDefault(); onClose(); }} aria-label={title}><div className="modal-header"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button className="icon-button" onClick={onClose} aria-label="Tutup"><X size={20} /></button></div>{children}</dialog>;
}

function BatchForm({ type, batch, onSave, onClose }: { type: Batch["type"]; batch?: Batch; onSave: (batch: Batch) => void; onClose: () => void }) {
  const [name, setName] = useState(batch?.name ?? "");
  const [origin, setOrigin] = useState(batch?.origin ?? "");
  const [closeDate, setCloseDate] = useState(batch?.closeDate ?? new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" }));
  return <SimpleModal title={batch ? "Edit batch" : type === "po" ? "Batch PO baru" : "Batch jastip baru"} subtitle="Kumpulkan titipan dalam satu batch yang rapi." onClose={onClose}><form onSubmit={(e) => { e.preventDefault(); onSave({ id: batch?.id ?? crypto.randomUUID(), name: name.trim(), type, origin: origin.trim(), closeDate, status: batch?.status ?? "open", directCosts: batch?.directCosts ?? 0 }); }}><div className="modal-body"><div className="field"><label className="field-label" htmlFor="batch-name">Nama batch<span className="required-mark" aria-hidden="true"> *</span></label><input aria-label="Nama batch" id="batch-name" className="input" autoFocus required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} placeholder="Contoh: Seoul Beauty • November" /></div><div className="form-grid batch-fields-row"><div className="field"><label className="field-label" htmlFor="batch-type">Jenis titipan</label><input id="batch-type" className="input" readOnly value={type === "po" ? "Open PO" : "Jastip"} /></div><div className="field"><label className="field-label" htmlFor="batch-close">Tutup pesanan<span className="required-mark" aria-hidden="true"> *</span></label><input aria-label="Tutup pesanan" id="batch-close" className="input" type="date" required value={closeDate} onChange={(e) => setCloseDate(e.target.value)} /></div></div><div className="field"><label className="field-label" htmlFor="batch-origin">Lokasi / supplier</label><input id="batch-origin" className="input" maxLength={120} value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder="Contoh: Seoul, Korea Selatan" /></div></div><div className="modal-footer"><Button type="button" className="btn btn-secondary" onClick={onClose}>Batal</Button><Button type="submit" className="btn btn-primary">Simpan batch <ArrowRight size={16} /></Button></div></form></SimpleModal>;
}

function CustomerForm({ customer, onSave, onClose }: { customer?: Customer; onSave: (customer: Customer) => Promise<boolean>; onClose: () => void }) {
  const [id] = useState(() => customer?.id ?? crypto.randomUUID());
  const [name, setName] = useState(customer?.name ?? "");
  const [phone, setPhone] = useState(customer?.phone ?? "");
  const [address, setAddress] = useState(customer?.address ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    if (!name.trim()) { setError("Isi nama pelanggan."); return; }
    setError(""); setSaving(true);
    try { if (!await onSave({ id, name: name.trim(), phone: phone.trim(), address: address.trim() })) setError("Pelanggan belum tersimpan. Coba lagi."); }
    catch { setError("Pelanggan belum tersimpan. Coba lagi."); }
    finally { setSaving(false); }
  }
  return <SimpleModal title={customer ? "Edit pelanggan" : "Tambah pelanggan"} onClose={onClose}>
    <form onSubmit={submit} aria-busy={saving}>
      <div className="modal-body">
        <div className="field"><label className="field-label" htmlFor="customer-edit-name">Nama pelanggan<span className="required-mark" aria-hidden="true"> *</span></label><input aria-label="Nama pelanggan" id="customer-edit-name" className="input" autoFocus required maxLength={120} disabled={saving} value={name} onChange={(event) => setName(event.target.value)} /></div>
        <div className="field"><label className="field-label" htmlFor="customer-edit-phone">Nomor WhatsApp (opsional)</label><input id="customer-edit-phone" type="tel" className="input" maxLength={30} disabled={saving} value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="08..." /></div>
        <div className="field"><label className="field-label" htmlFor="customer-edit-address">Alamat (opsional)</label><textarea id="customer-edit-address" className="input" rows={3} maxLength={1000} autoComplete="street-address" disabled={saving} value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Jalan, nomor rumah, kecamatan, kota, dan kode pos" /></div>
        <p className="field-hint">Nomor disimpan sebagai data pelanggan. Invoice dapat disalin ke WhatsApp.</p>
        {error && <p className="error-message" role="alert">{error}</p>}
      </div>
      <div className="modal-footer"><Button type="button" className="btn btn-secondary" disabled={saving} onClick={onClose}>Batal</Button><Button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Menyimpan…" : "Simpan pelanggan"}</Button></div>
    </form>
  </SimpleModal>;
}


function DataSettings({ data, cloud, onUpdate, onNotify }: { data: AppData; cloud?: boolean; onUpdate: (next: AppData, message: string) => void; onNotify: (message: string) => void }) {
  const file = useRef<HTMLInputElement>(null);
  const [confirm, setConfirm] = useState<"empty" | "demo" | null>(null);
  function exportData() {
    const content = JSON.stringify({ schemaVersion: 3, exportedAt: new Date().toISOString(), data }, null, 2);
    const url = URL.createObjectURL(new Blob([content], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = `tippo-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click(); URL.revokeObjectURL(url);
    onNotify("Salinan data berhasil diunduh");
  }
  async function importData(input: HTMLInputElement) {
    const uploaded = input.files?.[0]; if (!uploaded) return;
    try {
      if (uploaded.size > 10 * 1024 * 1024) throw new Error("Berkas terlalu besar. Batas impor 10 MB.");
      const value = JSON.parse(await uploaded.text());
      const normalized = value && [1, 2, 3].includes(value.schemaVersion) ? normalizeAppData(value.data) : null;
      if (!normalized) throw new Error("Format data tidak sesuai atau isi pesanan tidak valid.");
      if (!window.confirm("Impor akan mengganti data lokal saat ini. Sudah mengekspor salinan?")) return;
      onUpdate(normalized, "Data berhasil dipulihkan dari salinan");
    } catch (error) { onNotify(error instanceof Error ? error.message : "Data tidak bisa diimpor."); }
    finally { input.value = ""; }
  }
  return <div className="settings-layout">
    <section className="card settings-card"><div className="settings-icon"><FileJson size={25} /></div><h2>Simpan salinan data usaha.</h2>
      <p>{cloud ? "Pesanan disimpan di akunmu dan dapat dibuka dari perangkat lain. Unduh salinan untuk cadangan." : "Contoh dan perubahan pada ruang demo disimpan di browser ini. Unduh salinan sebelum mengganti perangkat."}</p>
      <div className="settings-counts"><div><strong>{data.orders.length}</strong><span>Pesanan</span></div><div><strong>{data.batches.length}</strong><span>Batch</span></div><div><strong>{data.customers.length}</strong><span>Pelanggan</span></div></div>
      <div className="settings-actions"><Button className="btn btn-primary" onClick={exportData}><Download size={17} />Ekspor data</Button><Button className="btn btn-secondary" onClick={() => file.current?.click()}><Upload size={17} />Impor salinan</Button><input hidden ref={file} type="file" accept="application/json,.json" onChange={(e) => void importData(e.target)} /></div>
      <div className="settings-warning"><CircleHelp size={18} /><p>{cloud ? "Berkas cadangan memuat informasi pelanggan. Simpan dengan aman dan periksa isinya sebelum memulihkan data." : "Data demo dapat hilang jika penyimpanan browser dihapus. Berkas cadangan memuat informasi pelanggan; simpan dengan aman."}</p></div>
    </section>
    <section className="card settings-card"><h2>Mulai dari ruang bersih</h2><p>{cloud ? "Kosongkan transaksi akun jika ingin memulai kembali. Ekspor salinan lebih dulu; kuota tetap tercatat." : "Data awal merupakan contoh fiktif. Hapus contoh sebelum mencatat transaksi usahamu sendiri."}</p><Button className="btn btn-secondary" onClick={() => setConfirm("empty")}>Hapus semua & mulai kosong</Button>{!cloud && <button className="text-action reset-demo" onClick={() => setConfirm("demo")}>Muat ulang data contoh</button>}<div className="settings-divider" /><h3>{cloud ? "Ruang pribadi usahamu" : "Lanjutkan dengan akun"}</h3><p>{cloud ? "Data akun dapat dibuka setelah masuk dengan email yang sama. Ekspor salinan data secara rutin." : "Daftar untuk menyimpan data usaha di akun pribadi. Data demo tidak dipindahkan otomatis ke akun."}</p>{cloud ? <span className="status-tag status-new">Terhubung ke akun</span> : <Link className="btn btn-primary" href="/daftar">Buat akun gratis</Link>}</section>
    {confirm && <SimpleModal title={confirm === "empty" ? "Mulai tanpa data contoh?" : "Muat ulang data contoh?"} onClose={() => setConfirm(null)}><div className="modal-body"><p>{cloud ? "Ini akan mengganti data transaksi pada akunmu." : "Ini akan mengganti data transaksi pada browser ini."} Ekspor salinan terlebih dahulu jika ada transaksi yang ingin disimpan. Kuota pesanan bulan ini tetap tersimpan.</p></div><div className="modal-footer"><Button className="btn btn-secondary" onClick={() => setConfirm(null)}>Batal</Button><Button className="btn btn-primary" onClick={() => { onUpdate(confirm === "empty" ? { batches: [], orders: [], customers: [], products: [] } : structuredClone(seedData), confirm === "empty" ? "Data dikosongkan. Siap untuk mencatat pesanan." : "Data contoh berhasil dimuat"); setConfirm(null); }}>Ya, {confirm === "empty" ? "mulai kosong" : "muat contoh"}</Button></div></SimpleModal>}
  </div>;
}
