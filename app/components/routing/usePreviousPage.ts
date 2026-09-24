import { useEffect, useState } from "react";
import { useLocation, useNavigationType } from "react-router";
import { parseNavigationHistory, recordNavigationEntry } from "~/utils/navigation-history";

const STORAGE_KEY = "roseu:navigation-history";

export function usePreviousPage() {
  const location = useLocation();
  const action = useNavigationType();
  const path = location.pathname + location.search + location.hash;
  const [previous, setPrevious] = useState<{
    key: string;
    path: string | null;
    available: boolean;
  } | null>(null);

  useEffect(() => {
    const index: unknown = window.history.state?.idx;
    if (typeof index !== "number" || !Number.isSafeInteger(index) || index < 0) {
      setPrevious({ key: location.key, path: null, available: false });
      return;
    }

    let previousPath: string | null = null;
    try {
      const entries = recordNavigationEntry(
        parseNavigationHistory(window.sessionStorage.getItem(STORAGE_KEY)),
        { index, key: location.key, path },
        action,
      );
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
      previousPath = entries.find((entry) => entry.index === index - 1)?.path ?? null;
    } catch {
      // Storage may be disabled. Keep browser-back behavior without guessing a label.
    }
    setPrevious({ key: location.key, path: previousPath, available: index > 0 });
  }, [location.key, path, action]);

  return previous?.key === location.key ? previous : null;
}
