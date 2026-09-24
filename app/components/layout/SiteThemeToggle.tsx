import * as React from "react";
import { Moon, Sun } from "lucide-react";
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
      <Moon
        ref={moonIconRef}
        className="theme-toggle-btn__icon"
        size={16}
        strokeWidth={1.7}
        aria-hidden="true"
      />
      <Sun
        ref={sunIconRef}
        className="theme-toggle-btn__icon hidden"
        size={16}
        strokeWidth={1.7}
        aria-hidden="true"
      />
    </button>
  );
}
