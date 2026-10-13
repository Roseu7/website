export function parseChangelog(source: string) {
  const entries: { version: string; build: number; date: string; changes: string[] }[] = [];
  for (const line of source.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const heading = /^## (.+) \(Build ([1-9]\d*)\) - (\d{4}-\d{2}-\d{2})$/.exec(line);
    if (heading) {
      const [, version, build, date] = heading;
      if (!Number.isSafeInteger(Number(build))) throw new Error("changelog.md: invalid build number");
      if (Number.isNaN(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) throw new Error(`changelog.md: invalid date ${date}`);
      entries.push({ version, build: Number(build), date, changes: [] });
    } else if (line.startsWith("- ") && entries.length && line.slice(2).trim()) {
      entries.at(-1)!.changes.push(line.slice(2));
    } else {
      throw new Error(`changelog.md: expected ## version (Build number) - YYYY-MM-DD or - change: ${line}`);
    }
  }
  if (entries.some(entry => !entry.changes.length)) throw new Error("changelog.md: each version requires at least one change");
  return entries;
}
