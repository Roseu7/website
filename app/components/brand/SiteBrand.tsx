import { siteConfig } from "~/utils/site";

interface SiteBrandProps {
  compact?: boolean;
  interactive?: boolean;
  mode?: "default" | "wordmark";
}

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function SiteBrand({
  compact = false,
  interactive = false,
  mode = "default",
}: SiteBrandProps) {
  const words = siteConfig.name.split(" ");

  if (compact) {
    return (
      <div className="site-brand site-brand--compact">
        <span className="site-brand__compact-name">{siteConfig.name}</span>
      </div>
    );
  }

  return (
    <div
      className={cx(
        "site-brand",
        "site-brand--hero",
        mode === "wordmark" && "site-brand--wordmark-only",
        interactive && "site-brand--interactive"
      )}
    >
      <div className="site-brand__copy">
        <div className="site-brand__wordmark" aria-label={siteConfig.name}>
          {words.map((word) => (
            <span key={word} className="site-brand__name-line">
              {word}
            </span>
          ))}
        </div>
        {mode === "default" ? (
          <span className="site-brand__underline" aria-hidden="true" />
        ) : null}
      </div>
    </div>
  );
}
