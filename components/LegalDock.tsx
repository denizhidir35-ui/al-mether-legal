"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

export default function LegalDock() {
  const pathname = usePathname();

  const items = [    {
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
      href: "/settings",
      icon: "⚙",
      label: "Ayarlar",
    },
  ];

  return (
    <div className="legal-dock-zone">
      <nav className="legal-dock">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            prefetch={true}
            className={
              pathname === item.href
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
      </nav>

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

        @media (
          hover: none
        ),
        (
          max-width: 760px
        ) {
          .legal-dock-zone {
            height: 64px;
          }

          .legal-dock {
            opacity: 1;
            transform: none;
            pointer-events: auto;

            margin-bottom: 5px;
          }
        }
      `}</style>
    </div>
  );
}


