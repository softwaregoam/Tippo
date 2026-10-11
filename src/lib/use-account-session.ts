"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";

export function useAccountSession() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  useEffect(() => {
    const client = getSupabaseClient();
    if (!client) { queueMicrotask(() => setSignedIn(false)); return; }
    let active = true;
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      if (active) setSignedIn(Boolean(session));
    });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);
  return signedIn;
}
