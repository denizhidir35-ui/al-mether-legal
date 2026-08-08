"use client";

import { usePathname } from "next/navigation";

export default function LegalDock() {
  const pathname = usePathname();

  const items = [
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
          <a
            key={item.href}
            href={item.href}
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
          </a>
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

          border: 1px solid #25324a;
          border-radius: 18px;

          background:
            rgba(13, 22, 38, 0.92);

          backdrop-filter: blur(22px);
          -webkit-backdrop-filter: blur(22px);

          box-shadow:
            0 18px 50px
            rgba(0, 0, 0, 0.34);

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

          color: #8294b0;

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
            #33425e;

          background:
            #142035;

          color:
            #ffffff;
        }

        .legal-dock a.active {
          border-color:
            #7658ff;

          background:
            rgba(
              118,
              88,
              255,
              0.18
            );

          color:
            #a993ff;
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
