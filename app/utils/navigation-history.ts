export interface NavigationEntry {
  index: number;
  key: string;
  path: string;
}

export function parseNavigationHistory(value: string | null): NavigationEntry[] {
  try {
    const entries: unknown = JSON.parse(value ?? "[]");
    if (!Array.isArray(entries)) return [];
    return entries.filter((entry): entry is NavigationEntry =>
      entry != null && Number.isSafeInteger(entry.index) && entry.index >= 0 &&
      typeof entry.key === "string" && typeof entry.path === "string" &&
      entry.path.startsWith("/") && !entry.path.startsWith("//") &&
      !entry.path.includes("\\"),
    );
  } catch {
    return [];
  }
}

export function recordNavigationEntry(
  entries: NavigationEntry[],
  current: NavigationEntry,
  action: "PUSH" | "POP" | "REPLACE",
): NavigationEntry[] {
  const existing = entries.find((entry) => entry.index === current.index);
  // Both PageLayout and its back link record the same location. Repeating a
  // record must not change which entry precedes it, including on reload/POP.
  if (existing?.key === current.key && existing.path === current.path) return entries;

  const retained = current.index === 0 ? [] : entries.filter((entry) =>
    entry.index !== current.index && (action !== "PUSH" || entry.index < current.index),
  );
  return [...retained, current]
    .sort((a, b) => Math.abs(a.index - current.index) - Math.abs(b.index - current.index))
    .slice(0, 200);
}
