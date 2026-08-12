"use client";

import { SessionProvider } from "next-auth/react";
import AccountApprovalGate from "@/components/AccountApprovalGate";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <AccountApprovalGate>{children}</AccountApprovalGate>
    </SessionProvider>
  );
}
