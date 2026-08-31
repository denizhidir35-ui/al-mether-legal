"use client";

import { signOut } from "next-auth/react";

import { createClient } from "@/lib/supabaseClient";
import { setAccountStorageScope } from "@/lib/accountStorage";

export async function signOutLegalSession() {
  setAccountStorageScope(null);
  try { await createClient().auth.signOut({ scope: "local" }); }
  finally { await signOut({ callbackUrl: "/login" }); }
}

export default function LegalSessionControl() {
  return null;
}
