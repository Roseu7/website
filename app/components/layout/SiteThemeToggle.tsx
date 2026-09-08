import * as React from "react";
import { attachThemeToggle } from "~/utils/theme";

interface SiteThemeToggleProps {
  className?: string;
}

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function SiteThemeToggle({ className }: SiteThemeToggleProps) {
  const buttonRef = React.useRef<HTMLButtonElement | null>(null);
  const sunIconRef = React.useRef<SVGSVGElement | null>(null);
  const moonIconRef = React.useRef<SVGSVGElement | null>(null);

  React.useEffect(() => {
    return attachThemeToggle({
      button: buttonRef.current,
      sunIcon: sunIconRef.current,
      moonIcon: moonIconRef.current,
    });
  }, []);

  return (
    <button
      ref={buttonRef}
      className={cx("btn theme-toggle-btn", className)}
      type="button"
      aria-label="Toggle theme"
      aria-pressed="false"
    >
      <span className="sr-only">Toggle theme</span>
      <svg
        ref={moonIconRef}
        className="theme-toggle-btn__icon"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.7"
          d="M20.354 15.354A9 9 0 018.646 3.646 9.001 9.001 0 0012 21a9 9 0 008.354-5.646z"
        />
      </svg>
      <svg
        ref={sunIconRef}
        className="theme-toggle-btn__icon hidden"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.7"
          d="M12 3v2.25M12 18.75V21M4.954 4.954l1.591 1.591M17.455 17.455l1.591 1.591M3 12h2.25M18.75 12H21M4.954 19.046l1.591-1.591M17.455 6.545l1.591-1.591M15.75 12A3.75 3.75 0 118.25 12a3.75 3.75 0 017.5 0z"
        />
      </svg>
    </button>
  );
}
