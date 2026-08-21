"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { signOutLegalSession } from "@/components/LegalSessionControl";
import LegalBrand from "@/components/LegalBrand";

type LegalTheme = "light" | "dark";

type MobileNotification = {
  id: string;
  title: string;
  date: string;
  time?: string;
  category?: string;
  eventType?: string;
  caseId?: string;
  readAt?: string;
};

type MobileDashboardData = {
  dailyPlan?: MobileNotification[];
  timeline?: MobileNotification[];
  incoming?: MobileNotification[];
};

export default function LegalDock() {
  const pathname = usePathname();
  const router = useRouter();
  const isDashboard = pathname === "/" || pathname === "/dashboard";

  const [theme, setTheme] = useState<LegalTheme>("light");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileActionsOpen, setMobileActionsOpen] = useState(false);
  const [mobileNotificationsOpen, setMobileNotificationsOpen] = useState(false);
  const [mobileNotifications, setMobileNotifications] = useState<MobileNotification[]>([]);
  const [readNotificationIds, setReadNotificationIds] = useState<Set<string>>(new Set());
  const [isAdmin, setIsAdmin] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTheme(
      window.localStorage.getItem("legal-theme") === "dark"
        ? "dark"
        : "light"
    );
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
    setMobileActionsOpen(false);
    setMobileNotificationsOpen(false);
  }, [pathname]);

  useEffect(() => {
    let active = true;

    if (!window.matchMedia("(max-width: 760px)").matches) {
      return () => {
        active = false;
      };
    }

    async function loadMobileShellData() {
      const [dashboardResponse, adminResponse] = await Promise.allSettled([
        fetch("/api/dashboard-v2", { cache: "no-store" }),
        fetch("/api/admin/users", { cache: "no-store" }),
      ]);

      if (!active) return;

      if (dashboardResponse.status === "fulfilled" && dashboardResponse.value.ok) {
        const payload = (await dashboardResponse.value.json()) as MobileDashboardData;
        const unique = new Map<string, MobileNotification>();
        for (const item of [
          ...(payload.incoming || []),
          ...(payload.dailyPlan || []),
          ...(payload.timeline || []),
        ]) {
          if (item?.id && !unique.has(item.id)) unique.set(item.id, item);
        }
        if (active) {
          const notifications = Array.from(unique.values()).slice(0, 12);
          setMobileNotifications(notifications);
          setReadNotificationIds(
            new Set(
              notifications
                .filter((item) => Boolean(item.readAt))
                .map((item) => item.id)
            )
          );
        }
      }

      setIsAdmin(
        adminResponse.status === "fulfilled" && adminResponse.value.ok
      );
    }

    void loadMobileShellData();

    const refreshOnFocus = () => {
      if (document.visibilityState === "visible") {
        void loadMobileShellData();
      }
    };

    window.addEventListener("focus", refreshOnFocus);
    document.addEventListener("visibilitychange", refreshOnFocus);

    return () => {
      active = false;
      window.removeEventListener("focus", refreshOnFocus);
      document.removeEventListener("visibilitychange", refreshOnFocus);
    };
  }, []);

  useEffect(() => {
    const open = mobileMenuOpen || mobileActionsOpen || mobileNotificationsOpen;
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function closeWithEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setMobileMenuOpen(false);
      setMobileActionsOpen(false);
      setMobileNotificationsOpen(false);
    }

    window.addEventListener("keydown", closeWithEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeWithEscape);
    };
  }, [mobileActionsOpen, mobileMenuOpen, mobileNotificationsOpen]);

  function applyTheme(nextTheme: LegalTheme) {
    setTheme(nextTheme);
    window.localStorage.setItem("legal-theme", nextTheme);
    document.documentElement.classList.toggle("dark", nextTheme === "dark");
    document.documentElement.setAttribute("data-legal-theme", nextTheme);
    document.documentElement.style.colorScheme = nextTheme;
    window.dispatchEvent(
      new CustomEvent("legal-theme-change", {
        detail: { theme: nextTheme },
      })
    );
  }

  const items = [
    {
      href: "/",
      icon: "⌂",
      label: "Bugün",
    },
    {
      href: "/inbox",
      icon: "✉",
      label: "Gelen",
    },

    {
      href: "/calendar",
      icon: "▦",
      label: "Takvim",
    },
    {
      href: "/cases",
      icon: "⚖",
      label: "Davalar",
    },
    {
      href: "/converter",
      icon: "⇄",
      label: "Dönüştür",
    },
    {
      href: "/uets-import",
      icon: "↧",
      label: "UETS",
    },
    {
      href: "/celse-import",
      icon: "§",
      label: "CELSE / UYAP",
    },
    {
      href: "/mail-connect",
      icon: "@",
      label: "Mail",
    },
    {
      href: "/settings",
      icon: "⚙",
      label: "Ayarlar",
    },
  ];

  const mobileMenuItems = items.filter((item) =>
    ["/uets-import", "/celse-import", "/converter", "/settings"].includes(item.href)
  );

  const mobileNavItems = [
    { href: "/", icon: "⌂", label: "Bugün" },
    { href: "/cases", icon: "⚖", label: "Davalar" },
    { href: "/inbox", icon: "✉", label: "Mail" },
    { href: "/calendar", icon: "▦", label: "Takvim" },
  ];

  const mobileTitle = useMemo(() => {
    if (isDashboard) return "Bugün";
    return items.find((item) => item.href === pathname)?.label || "AL METHER Legal";
  }, [isDashboard, items, pathname]);

  const unreadCount = mobileNotifications.filter(
    (item) => !readNotificationIds.has(item.id)
  ).length;

  function notificationHref(item: MobileNotification) {
    if (item.eventType === "mail_received") return "/inbox";
    if (
      item.caseId &&
      (item.eventType === "deemed_service" || item.eventType === "notification_review")
    ) {
      return `/cases?case=${encodeURIComponent(item.caseId)}`;
    }
    return `/calendar?event=${encodeURIComponent(item.id)}`;
  }

  async function markNotificationRead(id: string) {
    setReadNotificationIds((current) => {
      const next = new Set(current);
      next.add(id);
      return next;
    });
    setMobileNotificationsOpen(false);

    try {
      const response = await fetch("/api/dashboard-v2", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId: id }),
      });

      if (!response.ok) {
        throw new Error("Bildirim okundu olarak kaydedilemedi.");
      }
    } catch {
      setReadNotificationIds((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
    }
  }

  function queueMobileFiles(
    mode: "camera" | "gallery" | "document",
    fileList: FileList | null
  ) {
    const files = Array.from(fileList || []);
    if (files.length === 0) return;

    const name = files[0].name.toLocaleLowerCase("tr-TR");
    const tool = mode !== "document"
      ? "image_text"
      : name.endsWith(".doc") || name.endsWith(".docx")
        ? "word_pdf"
        : name.endsWith(".pdf")
          ? "pdf_text"
          : "image_pdf";

    const pendingUpload = { tool, files };

    (window as typeof window & {
      __alMetherMobileUpload?: { tool: string; files: File[] };
    }).__alMetherMobileUpload = pendingUpload;

    setMobileActionsOpen(false);
    if (pathname === "/converter") {
      window.dispatchEvent(
        new CustomEvent("al-mether-mobile-upload", { detail: pendingUpload })
      );
    } else {
      router.push(`/converter?tool=${encodeURIComponent(tool)}`);
    }
  }

  function openMobileNewCase() {
    (window as typeof window & {
      __alMetherMobileAction?: string;
    }).__alMetherMobileAction = "new-case";
    setMobileActionsOpen(false);

    if (pathname === "/cases") {
      window.dispatchEvent(new Event("al-mether-mobile-new-case"));
    } else {
      router.push("/cases");
    }
  }

  return (
    <div
      className="legal-dock-zone rail-mode"
    >
      <header className="mobile-legal-header">
        <Link href="/" className="mobile-brand-link" aria-label="AL METHER Legal ana sayfa">
          <LegalBrand compact />
        </Link>

        <strong className="mobile-page-title">{mobileTitle}</strong>

        <div className="mobile-header-actions">
          <button
            type="button"
            className="mobile-icon-button"
            aria-label="Bildirimler"
            aria-expanded={mobileNotificationsOpen}
            onClick={() => {
              setMobileNotificationsOpen((open) => !open);
              setMobileMenuOpen(false);
              setMobileActionsOpen(false);
            }}
          >
            <span aria-hidden="true">♢</span>
            {unreadCount > 0 && <span className="mobile-unread-badge">{unreadCount}</span>}
          </button>

        </div>
      </header>

      <nav className="mobile-bottom-navigation" aria-label="Ana navigasyon">
        {mobileNavItems.map((item) => (
          <Link
            key={`bottom-${item.href}`}
            href={item.href}
            className={item.href === "/" ? isDashboard ? "active" : "" : pathname === item.href ? "active" : ""}
          >
            <span aria-hidden="true">{item.icon}</span>
            <strong>{item.label}</strong>
          </Link>
        ))}
        <button
          type="button"
          className={mobileMenuOpen ? "active" : ""}
          aria-label="Menüyü aç"
          aria-expanded={mobileMenuOpen}
          onClick={() => {
            setMobileMenuOpen((open) => !open);
            setMobileNotificationsOpen(false);
            setMobileActionsOpen(false);
          }}
        >
          <span aria-hidden="true">☰</span>
          <strong>Menü</strong>
        </button>
      </nav>

      <nav className="legal-dock">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            prefetch={true}
            className={
              item.href === "/"
                ? isDashboard
                  ? "active"
                  : ""
                : pathname === item.href
                ? "active"
                : ""
            }
          >
            <span className="dock-icon">
              {item.icon}
            </span>

            <span className="dock-label">
              {item.label}
            </span>
          </Link>
        ))}

        <div className="dock-theme-switch" aria-label="Tema seçimi">
          <button
            type="button"
            className={theme === "light" ? "active" : ""}
            onClick={() => applyTheme("light")}
            aria-pressed={theme === "light"}
          >
            <span aria-hidden="true">☀</span>
            <span className="theme-label">Açık</span>
          </button>
          <button
            type="button"
            className={theme === "dark" ? "active" : ""}
            onClick={() => applyTheme("dark")}
            aria-pressed={theme === "dark"}
          >
            <span aria-hidden="true">☾</span>
            <span className="theme-label">Koyu</span>
          </button>
        </div>

        <button
          type="button"
          className="dock-logout"
          onClick={() => void signOutLegalSession()}
          title="Çıkış yap"
        >
          <span className="dock-icon" aria-hidden="true">↪</span>
          <span className="logout-label">Çıkış</span>
        </button>
      </nav>

      <button
        type="button"
        className="mobile-primary-action"
        aria-expanded={mobileActionsOpen}
        onClick={() => {
          setMobileActionsOpen((open) => !open);
          setMobileMenuOpen(false);
          setMobileNotificationsOpen(false);
        }}
      >
        <span aria-hidden="true">＋</span>
        İşlem
      </button>

      <input
        ref={cameraInputRef}
        className="mobile-file-input"
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(event) => queueMobileFiles("camera", event.target.files)}
      />
      <input
        ref={galleryInputRef}
        className="mobile-file-input"
        type="file"
        accept="image/*"
        onChange={(event) => queueMobileFiles("gallery", event.target.files)}
      />
      <input
        ref={documentInputRef}
        className="mobile-file-input"
        type="file"
        accept=".pdf,.doc,.docx,image/*"
        onChange={(event) => queueMobileFiles("document", event.target.files)}
      />

      {(mobileMenuOpen || mobileActionsOpen || mobileNotificationsOpen) && (
        <button
          type="button"
          className="mobile-sheet-backdrop"
          aria-label="Paneli kapat"
          onClick={() => {
            setMobileMenuOpen(false);
            setMobileActionsOpen(false);
            setMobileNotificationsOpen(false);
          }}
        />
      )}

      <aside className={`mobile-drawer ${mobileMenuOpen ? "open" : ""}`} aria-hidden={!mobileMenuOpen}>
        <div className="mobile-sheet-handle" />
        <div className="mobile-drawer-head">
          <strong>Menü</strong>
          <button type="button" onClick={() => setMobileMenuOpen(false)} aria-label="Menüyü kapat">×</button>
        </div>

        <nav className="mobile-menu-list">
          {mobileMenuItems.map((item) => (
            <Link
              key={`mobile-${item.href}`}
              href={item.href}
              className={
                item.href === "/"
                  ? isDashboard ? "active" : ""
                  : pathname === item.href ? "active" : ""
              }
            >
              <span aria-hidden="true">{item.icon}</span>
              <strong>{item.label}</strong>
            </Link>
          ))}
          {isAdmin && (
            <Link href="/settings#user-management">
              <span aria-hidden="true">♙</span>
              <strong>Kullanıcı Yönetimi</strong>
            </Link>
          )}
        </nav>

        <div className="mobile-drawer-footer">
          <div className="mobile-theme-switch" aria-label="Tema seçimi">
            <button type="button" className={theme === "light" ? "active" : ""} onClick={() => applyTheme("light")}>☀ Açık</button>
            <button type="button" className={theme === "dark" ? "active" : ""} onClick={() => applyTheme("dark")}>☾ Koyu</button>
          </div>
          <button type="button" className="mobile-logout" onClick={() => void signOutLegalSession()}>↪ Çıkış</button>
        </div>
      </aside>

      <aside className={`mobile-bottom-sheet ${mobileActionsOpen ? "open" : ""}`} aria-hidden={!mobileActionsOpen}>
        <div className="mobile-sheet-handle" />
        <div className="mobile-sheet-title"><strong>Yeni İşlem</strong></div>
        <div className="mobile-action-grid">
          <button type="button" onClick={() => cameraInputRef.current?.click()}>📷 <span>Fotoğraf Çek</span></button>
          <button type="button" onClick={() => galleryInputRef.current?.click()}>▧ <span>Galeriden Seç</span></button>
          <button type="button" onClick={() => documentInputRef.current?.click()}>↥ <span>Belge Yükle</span></button>
          <button type="button" onClick={openMobileNewCase}>⚖ <span>Yeni Dava</span></button>
          <Link href="/calendar">▦ <span>Takvime Ekle</span></Link>
          <Link href="/uets-import">↧ <span>UETS İçe Aktar</span></Link>
          <Link href="/celse-import">§ <span>CELSE / UYAP</span></Link>
        </div>
      </aside>

      <aside className={`mobile-bottom-sheet notification-sheet ${mobileNotificationsOpen ? "open" : ""}`} aria-hidden={!mobileNotificationsOpen}>
        <div className="mobile-sheet-handle" />
        <div className="mobile-sheet-title">
          <strong>Bildirimler</strong>
          <span>{unreadCount} okunmamış</span>
        </div>
        <div className="mobile-notification-list">
          {mobileNotifications.length === 0 ? (
            <div className="mobile-sheet-empty">Yeni bildirim bulunmuyor.</div>
          ) : mobileNotifications.map((item) => {
            const unread = !readNotificationIds.has(item.id);
            const tone = item.category || "task";
            const date = new Date(`${item.date}T12:00:00`);
            const timeLabel = Number.isNaN(date.getTime())
              ? item.date
              : new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "short" }).format(date);

            return (
              <Link
                key={`mobile-notification-${item.id}`}
                href={notificationHref(item)}
                className={`mobile-notification-row ${tone} ${unread ? "unread" : ""}`}
                onClick={async (event) => {
                  event.preventDefault();
                  const href = notificationHref(item);
                  await markNotificationRead(item.id);
                  router.push(href);
                }}
              >
                <span className="mobile-notification-mark" />
                <span><strong>{item.title}</strong><small>{timeLabel}{item.time ? ` · ${item.time}` : ""}</small></span>
                {unread && <span className="mobile-row-unread" aria-label="Okunmamış" />}
              </Link>
            );
          })}
        </div>
      </aside>

      <style jsx global>{`
        .legal-dock-zone {
          position: fixed;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 99999;

          height: 110px;

          display: flex;
          align-items: flex-end;
          justify-content: center;

          pointer-events: auto;
        }

        .legal-dock {
          display: flex;
          align-items: center;
          justify-content: center;

          gap: 8px;

          margin-bottom: 10px;

          padding: 7px 9px;

          border: 1px solid var(--legal-border);
          border-radius: 18px;

          background:
            var(--legal-surface);

          backdrop-filter: blur(22px);
          -webkit-backdrop-filter: blur(22px);

          box-shadow:
            var(--legal-shadow-md);

          opacity: 0;

          transform:
            translateY(28px)
            scale(0.96);

          pointer-events: none;

          transition:
            opacity 120ms ease,
            transform 120ms ease;
        }

        .legal-dock-zone:hover
        .legal-dock {
          opacity: 1;

          transform:
            translateY(0)
            scale(1);

          pointer-events: auto;
        }

        .legal-dock a {
          width: 46px;
          height: 46px;

          display: flex;
          align-items: center;
          justify-content: center;

          gap: 6px;

          border: 1px solid transparent;
          border-radius: 13px;

          color: var(--legal-muted);

          text-decoration: none;

          transition:
            width 130ms ease,
            transform 130ms ease,
            background 130ms ease,
            color 130ms ease;
        }

        .legal-dock a:hover {
          width: 92px;

          transform:
            translateY(-5px);

          border-color:
            var(--legal-border);

          background:
            var(--legal-surface-2);

          color:
            var(--legal-text);
        }

        .legal-dock a.active {
          border-color:
            var(--legal-gold);

          background:
            var(--legal-gold-soft);

          color:
            var(--legal-gold);
        }

        .dock-icon {
          font-size: 19px;
          line-height: 1;
        }

        .dock-label {
          display: none;

          font-size: 10px;
          font-weight: 800;

          white-space: nowrap;
        }

        .legal-dock a:hover
        .dock-label {
          display: inline;
        }

        .dock-theme-switch {
          display: none;
        }

        .dock-logout {
          height: 36px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          border: 1px solid transparent;
          border-radius: 11px;
          background: transparent;
          color: var(--legal-danger);
          cursor: pointer;
          font: inherit;
          font-size: 10px;
          font-weight: 800;
        }

        .mobile-legal-header,
        .mobile-bottom-navigation,
        .mobile-primary-action,
        .mobile-sheet-backdrop,
        .mobile-drawer,
        .mobile-bottom-sheet {
          display: none;
        }

        .mobile-file-input {
          position: fixed;
          width: 1px;
          height: 1px;
          overflow: hidden;
          opacity: 0;
          pointer-events: none;
        }

        @media (max-width: 760px) {
          .legal-dock-zone {
            inset: 0;
            width: 0;
            height: 0;
            pointer-events: none;
          }

          .legal-dock {
            display: none;
          }

          .mobile-legal-header {
            position: fixed;
            top: max(6px, env(safe-area-inset-top));
            right: max(8px, env(safe-area-inset-right));
            left: max(8px, env(safe-area-inset-left));
            z-index: 100003;
            height: 52px;
            display: grid;
            grid-template-columns: minmax(108px, auto) minmax(0, 1fr) 40px;
            align-items: center;
            gap: 8px;
            padding: 5px 7px 5px 9px;
            border: 1px solid var(--legal-border);
            border-radius: 15px;
            background: var(--legal-surface);
            box-shadow: var(--legal-shadow-sm);
            pointer-events: auto;
          }

          .mobile-brand-link {
            min-width: 0;
            color: inherit;
            text-decoration: none;
          }

          .mobile-page-title {
            overflow: hidden;
            color: var(--legal-text);
            font-size: 14px;
            font-weight: 850;
            text-align: center;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .mobile-header-actions {
            display: flex;
            gap: 5px;
          }

          .mobile-icon-button {
            position: relative;
            width: 36px;
            height: 36px;
            display: grid;
            padding: 0;
            border: 1px solid var(--legal-border);
            border-radius: 11px;
            background: var(--legal-surface-2);
            color: var(--legal-text-soft);
            cursor: pointer;
            font: inherit;
            font-size: 18px;
            place-items: center;
          }

          .mobile-unread-badge {
            position: absolute;
            top: -5px;
            right: -5px;
            min-width: 17px;
            height: 17px;
            display: grid;
            padding: 0 4px;
            border: 2px solid var(--legal-surface);
            border-radius: 999px;
            background: var(--legal-danger);
            color: #fff;
            font-size: 8px;
            font-weight: 900;
            place-items: center;
          }

          .mobile-primary-action {
            position: fixed;
            right: max(14px, calc(env(safe-area-inset-right) + 10px));
            bottom: calc(72px + env(safe-area-inset-bottom));
            z-index: 100002;
            height: 44px;
            display: inline-flex;
            align-items: center;
            gap: 5px;
            padding: 0 15px;
            border: 1px solid var(--legal-gold);
            border-radius: 15px;
            background: var(--legal-gold);
            color: #17130b;
            box-shadow: var(--legal-shadow-md);
            cursor: pointer;
            font: inherit;
            font-size: 11px;
            font-weight: 900;
            pointer-events: auto;
          }

          .mobile-sheet-backdrop {
            position: fixed;
            inset: 0;
            z-index: 100000;
            display: block;
            padding: 0;
            border: 0;
            background: var(--legal-overlay);
            pointer-events: auto;
          }

          .mobile-drawer,
          .mobile-bottom-sheet {
            position: fixed;
            z-index: 100001;
            display: flex;
            flex-direction: column;
            border: 1px solid var(--legal-border);
            background: var(--legal-surface);
            box-shadow: var(--legal-shadow-md);
            pointer-events: auto;
            transition: transform 200ms ease-out;
          }

          .mobile-drawer {
            top: max(8px, env(safe-area-inset-top));
            right: max(8px, env(safe-area-inset-right));
            bottom: max(8px, env(safe-area-inset-bottom));
            width: min(318px, calc(100vw - 16px - env(safe-area-inset-left) - env(safe-area-inset-right)));
            padding: 8px;
            overflow: hidden;
            border-radius: 22px;
            transform: translateX(calc(100% + 18px));
          }

          .mobile-bottom-navigation {
            position: fixed;
            right: 0;
            bottom: 0;
            left: 0;
            z-index: 100003;
            height: calc(64px + env(safe-area-inset-bottom));
            display: grid;
            grid-template-columns: repeat(5, minmax(0, 1fr));
            align-items: start;
            padding: 5px max(6px, env(safe-area-inset-right)) env(safe-area-inset-bottom) max(6px, env(safe-area-inset-left));
            border-top: 1px solid var(--legal-border);
            background: var(--legal-surface);
            box-shadow: 0 -8px 24px rgba(34, 27, 17, 0.08);
            pointer-events: auto;
          }

          .mobile-bottom-navigation a,
          .mobile-bottom-navigation button {
            min-width: 0;
            height: 54px;
            display: grid;
            align-content: center;
            justify-items: center;
            gap: 2px;
            padding: 0 2px;
            border: 0;
            border-radius: 11px;
            background: transparent;
            color: var(--legal-muted);
            text-decoration: none;
            font: inherit;
          }

          .mobile-bottom-navigation span { font-size: 18px; line-height: 1; }
          .mobile-bottom-navigation strong { overflow: hidden; max-width: 100%; font-size: 11px; font-weight: 750; text-overflow: ellipsis; white-space: nowrap; }
          .mobile-bottom-navigation .active { background: var(--legal-gold-soft); color: var(--legal-gold-dark); }

          .mobile-drawer.open,
          .mobile-bottom-sheet.open {
            transform: translate(0);
          }

          .mobile-sheet-handle {
            width: 34px;
            height: 4px;
            flex: 0 0 4px;
            margin: 1px auto 7px;
            border-radius: 999px;
            background: var(--legal-border-strong);
          }

          .mobile-drawer-head,
          .mobile-sheet-title {
            min-height: 42px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            padding: 5px 7px 9px;
            border-bottom: 1px solid var(--legal-border);
          }

          .mobile-drawer-head strong,
          .mobile-sheet-title strong {
            font-size: 13px;
          }

          .mobile-sheet-title span {
            color: var(--legal-muted);
            font-size: 9px;
          }

          .mobile-drawer-head button {
            width: 32px;
            height: 32px;
            border: 1px solid var(--legal-border);
            border-radius: 10px;
            background: var(--legal-surface-2);
            color: var(--legal-text-soft);
            font-size: 18px;
          }

          .mobile-menu-list {
            min-height: 0;
            display: grid;
            align-content: start;
            gap: 4px;
            padding: 8px 0;
            overflow-y: auto;
            scrollbar-width: thin;
          }

          .mobile-menu-list a {
            min-height: 42px;
            display: grid;
            grid-template-columns: 26px minmax(0, 1fr);
            align-items: center;
            gap: 8px;
            padding: 0 10px;
            border: 1px solid transparent;
            border-radius: 12px;
            color: var(--legal-text-soft);
            text-decoration: none;
          }

          .mobile-menu-list a.active {
            border-color: var(--legal-gold);
            background: var(--legal-gold-soft);
            color: var(--legal-gold-dark);
          }

          .mobile-menu-list a strong {
            font-size: 11px;
          }

          .mobile-drawer-footer {
            display: grid;
            gap: 7px;
            margin-top: auto;
            padding-top: 8px;
            border-top: 1px solid var(--legal-border);
          }

          .mobile-theme-switch {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 5px;
          }

          .mobile-theme-switch button,
          .mobile-logout {
            height: 38px;
            border: 1px solid var(--legal-border);
            border-radius: 11px;
            background: var(--legal-surface-2);
            color: var(--legal-text-soft);
            font: inherit;
            font-size: 10px;
            font-weight: 800;
          }

          .mobile-theme-switch button.active {
            border-color: var(--legal-gold);
            background: var(--legal-gold-soft);
            color: var(--legal-gold-dark);
          }

          .mobile-logout {
            color: var(--legal-danger);
          }

          .mobile-bottom-sheet {
            right: max(8px, env(safe-area-inset-right));
            bottom: max(8px, env(safe-area-inset-bottom));
            left: max(8px, env(safe-area-inset-left));
            max-height: min(72dvh, 640px);
            padding: 8px 8px calc(8px + env(safe-area-inset-bottom));
            overflow: hidden;
            border-radius: 22px;
            transform: translateY(calc(100% + 28px));
          }

          .mobile-action-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 7px;
            padding: 10px 2px 2px;
          }

          .mobile-action-grid a,
          .mobile-action-grid button {
            min-height: 54px;
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 9px 11px;
            border: 1px solid var(--legal-border);
            border-radius: 13px;
            background: var(--legal-surface-2);
            color: var(--legal-text-soft);
            text-align: left;
            text-decoration: none;
            font: inherit;
            font-size: 16px;
          }

          .mobile-action-grid span {
            font-size: 10px;
            font-weight: 800;
          }

          .mobile-notification-list {
            min-height: 0;
            overflow-y: auto;
            padding: 6px 1px 1px;
            scrollbar-width: thin;
          }

          .mobile-notification-row {
            min-height: 52px;
            display: grid;
            grid-template-columns: 4px minmax(0, 1fr) 8px;
            align-items: center;
            gap: 9px;
            padding: 7px 9px;
            border-radius: 11px;
            color: var(--legal-text);
            text-decoration: none;
          }

          .mobile-notification-row.unread {
            background: var(--legal-gold-soft);
          }

          .mobile-notification-mark {
            width: 4px;
            height: 28px;
            border-radius: 999px;
            background: var(--legal-border-strong);
          }

          .mobile-notification-row.deadline .mobile-notification-mark {
            background: var(--legal-danger);
          }

          .mobile-notification-row.hearing .mobile-notification-mark {
            background: #3984c9;
          }

          .mobile-notification-row.notice .mobile-notification-mark {
            background: #168e94;
          }

          .mobile-notification-row > span:nth-child(2) {
            min-width: 0;
            display: grid;
            gap: 3px;
          }

          .mobile-notification-row strong,
          .mobile-notification-row small {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .mobile-notification-row strong {
            font-size: 10px;
          }

          .mobile-notification-row small {
            color: var(--legal-muted);
            font-size: 8px;
          }

          .mobile-row-unread {
            width: 6px;
            height: 6px;
            border-radius: 999px;
            background: var(--legal-gold);
          }

          .mobile-sheet-empty {
            padding: 28px 12px;
            color: var(--legal-muted);
            font-size: 10px;
            text-align: center;
          }

        }

        @media (min-width: 1024px) {
          .legal-app:has(.legal-dock-zone) {
            padding-right: 68px !important;
          }

          .legal-app:has(.legal-dock-zone.dashboard-mode) {
            padding-right: 187px !important;
          }

          .legal-dock-zone {
            top: 0;
            right: 0;
            bottom: 0;
            left: auto;

            width: 172px;
            height: 100dvh;
            min-height: 100dvh;
            max-height: 100dvh;
            padding:
              max(4px, env(safe-area-inset-top))
              max(2px, env(safe-area-inset-right))
              max(4px, env(safe-area-inset-bottom))
              0;
            box-sizing: border-box;

            align-items: stretch;
            justify-content: flex-start;

            pointer-events: auto;

            transition:
              width 200ms ease-out;
          }

          .legal-dock-zone.rail-mode {
            width: 56px;
          }

          .legal-dock-zone.rail-mode:hover,
          .legal-dock-zone.rail-mode:focus-within {
            width: 172px;
          }

          .legal-dock {
            width: 100%;
            height: 100%;
            min-height: 0;

            flex-direction: column;
            align-items: stretch;
            justify-content: flex-start;

            gap: 3px;

            margin: 0;
            padding: 7px;

            border-radius: 20px;

            opacity: 1;
            transform: none;
            pointer-events: auto;
          }

          .legal-dock a,
          .legal-dock a:hover {
            width: 100%;
            height: 36px;

            justify-content: flex-start;

            padding: 0 9px;

            border-radius: 11px;
          }

          .legal-dock a:hover {
            transform: translateX(-2px);
          }

          .dock-label,
          .legal-dock a:hover .dock-label {
            display: inline;

            font-size: 10px;
            font-weight: 750;
          }

          .legal-dock-zone.rail-mode .dock-label {
            width: 0;
            overflow: hidden;
            opacity: 0;

            transition:
              opacity 160ms ease-out;
          }

          .legal-dock-zone.rail-mode:hover .dock-label,
          .legal-dock-zone.rail-mode:focus-within .dock-label {
            width: auto;
            opacity: 1;
          }

          .dock-icon {
            width: 20px;
            font-size: 16px;
            text-align: center;
          }

          .dock-theme-switch {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 4px;

            margin-top: auto;
            padding-top: 7px;

            border-top: 1px solid var(--legal-border);
          }

          .dock-theme-switch button {
            height: 32px;

            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 4px;

            padding: 0;

            border: 1px solid transparent;
            border-radius: 10px;

            background: transparent;
            color: var(--legal-muted);

            cursor: pointer;

            font: inherit;
            font-size: 8px;
            font-weight: 800;
          }

          .dock-theme-switch button.active {
            border-color: var(--legal-border);
            background: var(--legal-surface-2);
            color: var(--legal-text);
          }

          .dock-logout {
            width: 100%;
            flex: 0 0 36px;
            justify-content: flex-start;
            padding: 0 9px;
          }

          .dock-logout:hover {
            border-color: color-mix(in srgb, var(--legal-danger) 35%, var(--legal-border));
            background: color-mix(in srgb, var(--legal-danger) 8%, transparent);
          }

          .legal-dock-zone.rail-mode .logout-label {
            width: 0;
            overflow: hidden;
            opacity: 0;
            white-space: nowrap;
            transition: opacity 160ms ease-out;
          }

          .legal-dock-zone.rail-mode:hover .logout-label,
          .legal-dock-zone.rail-mode:focus-within .logout-label {
            width: auto;
            opacity: 1;
          }

          .legal-dock-zone.rail-mode .theme-label {
            display: none;
          }

          .legal-dock-zone.rail-mode:hover .theme-label,
          .legal-dock-zone.rail-mode:focus-within .theme-label {
            display: inline;
          }
        }
      `}</style>
    </div>
  );
}


