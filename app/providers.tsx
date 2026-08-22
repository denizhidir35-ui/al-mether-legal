"use client";

import { SessionProvider } from "next-auth/react";
import { usePathname } from "next/navigation";
import AccountApprovalGate from "@/components/AccountApprovalGate";
import { isPublicIndexPath } from "@/lib/publicRoutes";

export default function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (isPublicIndexPath(pathname)) {
    return children;
  }

  return (
    <SessionProvider>
      <AccountApprovalGate>{children}</AccountApprovalGate>
    </SessionProvider>
  );
}
