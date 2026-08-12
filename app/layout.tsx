import type { Metadata, Viewport } from "next";
import "./globals.css";
import Providers from "./providers";
import GlobalLegalTheme from "@/components/GlobalLegalTheme";
import LegalAlarmNotifier from "@/components/LegalAlarmNotifier";
import LegalPushRegistration from "@/components/LegalPushRegistration";
import LegalPushPermissionPrompt from "@/components/LegalPushPermissionPrompt";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "Mether Legal",
  description: "Avukatın hukuki süre kaçırmasını engelleyen sistem.",
  manifest: "/manifest.json",
  icons: {
    icon: "/brand/legal-app-icon-light.png",
    shortcut: "/brand/legal-app-icon-light.png",
    apple: "/brand/legal-app-icon-light.png",
  },
  appleWebApp: {
    capable: true,
    title: "Mether Legal",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#090c12",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};


const LEGAL_THEME_BOOTSTRAP = `
(function () {
  try {
    var saved =
      localStorage.getItem(
        "legal-theme"
      );

    var theme =
      saved === "light"
        ? "light"
        : "dark";

    var root =
      document.documentElement;

    root.classList.toggle(
      "dark",
      theme === "dark"
    );

    root.setAttribute(
      "data-legal-theme",
      theme
    );

    root.style.colorScheme =
      theme;
  } catch (_) {}
})();
`;
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="tr"
      className={cn(
        "font-sans",
        geist.variable
      )}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              LEGAL_THEME_BOOTSTRAP,
          }}
        />
      </head>

      <body>
        <GlobalLegalTheme />
        <Providers>
          <LegalAlarmNotifier />
          <LegalPushRegistration />
          <LegalPushPermissionPrompt />
          {children}
        </Providers>
      </body>
    </html>
  );
}







