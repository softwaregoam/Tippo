"use client";
import { useEffect, useState } from "react";
import { AlertTriangle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Subscription } from "@/lib/subscription";

const DAYS_WARN = 7;

function daysUntil(dateString: string | null): number | null {
  if (!dateString) return null;
  const expires = Date.parse(dateString);
  if (!Number.isFinite(expires)) return null;
  const now = Date.now();
  return Math.ceil((expires - now) / (1000 * 60 * 60 * 24));
}

export function SubscriptionExpiryReminder({ subscription, onUpgrade }: { subscription: Subscription; onUpgrade: () => void }) {
  const [days, setDays] = useState(() => daysUntil(subscription.expiresAt));

  useEffect(() => {
    const timer = setInterval(() => setDays(daysUntil(subscription.expiresAt)), 60_000);
    return () => clearInterval(timer);
  }, [subscription.expiresAt]);

  const isProActive = subscription.tier === "pro" && subscription.expiresAt && days !== null && days >= 0;
  const shouldWarn = isProActive && days <= DAYS_WARN;

  if (!shouldWarn) return null;

  const expiryLabel = subscription.expiresAt
    ? new Date(subscription.expiresAt).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "Asia/Jakarta",
      })
    : "—";

  return (
    <div className="expiry-reminder-banner" role="alert" aria-label="Peringatan masa Pro akan berakhir">
      <div className="expiry-reminder-content">
        <div className="expiry-reminder-icon">
          <AlertTriangle size={20} aria-hidden="true" />
        </div>
        <div className="expiry-reminder-body">
          <strong>Masa Pro akan berakhir dalam {days} hari</strong>
          <p>Paket Pro aktif sampai {expiryLabel}. Perpanjang sebelum berakhir agar kuota dan fitur Pro tetap aktif.</p>
        </div>
        <Button className="btn btn-secondary expiry-reminder-button" onClick={onUpgrade}>
          <Clock size={16} aria-hidden="true" /> Perpanjang sekarang
        </Button>
      </div>
    </div>
  );
}
