"use client";

import { signOut } from "next-auth/react";

import { createClient } from "@/lib/supabaseClient";

export async function signOutLegalSession() {
  await createClient().auth.signOut({ scope: "local" });
  await signOut({ callbackUrl: "/login" });
}

export default function LegalSessionControl() {
  return null;
}
