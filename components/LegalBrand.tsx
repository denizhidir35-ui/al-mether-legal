"use client";

export default function LegalBrand({
  compact = false,
}: {
  compact?: boolean;
}) {
  return (
    <div
      className={
        compact
          ? "legal-brand compact"
          : "legal-brand"
      }
    >
      <picture>
        <source
          media="(prefers-color-scheme: light)"
          srcSet="/brand/legal-icon-light.png"
        />

        <img
          src="/brand/legal-icon-dark.png"
          alt="Mether Legal"
        />
      </picture>

      <div className="legal-brand-copy">
        <strong>
          METHER LEGAL
        </strong>

        {!compact && (
          <span>
            AL METHER
          </span>
        )}
      </div>
    </div>
  );
}
