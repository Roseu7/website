export const osApps = [
  { id: "projects", label: "プロジェクト.pdf", path: "/projects", icon: "pdf" },
  { id: "about", label: "プロフィール", path: "/about", icon: "profile" },
  { id: "games", label: "ゲーム", path: "/games", icon: "game" },
  { id: "tools", label: "ツール", path: "/tools", icon: "tools" },
  { id: "documents", label: "ドキュメント", path: "/licenses", icon: "document" },
  { id: "contact", label: "お問い合わせ", path: "/contact", icon: "mail" },
  { id: "settings", label: "設定", path: "/settings", icon: "settings" },
] as const;

const labApp = { id: "lab", label: "Lab", path: "/lab", icon: "folder" } as const;
const systemApp = { id: "system", label: "システムエラー", path: "/", icon: "system" } as const;
const consoleApp = { id: "console", label: "コマンド プロンプト", path: "/console", icon: "console", parent: "settings", executablePath: "C:\\ROS3U\\System32\\console.exe" } as const;
const notepadApp = { id: "notepad", label: "メモ帳", path: "/notepad", icon: "document", parent: "console", executablePath: "C:\\ROS3U\\System32\\notepad.exe" } as const;
const childApps = [
  { id: "wsolver", label: "Wordle Solver", path: "/tools/wsolver", icon: "tools", parent: "tools" },
  { id: "jev", label: "Jev", path: "/tools/jev", icon: "tools", parent: "tools" },
  { id: "umigame", label: "ウミガメのスープ", path: "/games/umigame", icon: "game", parent: "games" },
] as const;
export const osExecutableApps = [...osApps, ...childApps, consoleApp, notepadApp].map(app => ({ ...app, executable: `${app.id}.exe`, executablePath: "executablePath" in app ? app.executablePath : `C:\\Apps\\${app.id}.exe` }));
export type OsApp = (typeof osApps)[number] | (typeof childApps)[number] | typeof labApp | typeof systemApp | typeof consoleApp | typeof notepadApp;
export function getOsApp(id: OsApp["id"]): OsApp {
  return id === "lab" ? labApp : id === "system" ? systemApp : id === "console" ? consoleApp : id === "notepad" ? notepadApp : [...osApps, ...childApps].find(app => app.id === id)!;
}
export function getOsHomePath(id: OsApp["id"]) {
  const app = getOsApp(id);
  return "parent" in app ? getOsApp(app.parent).path : app.path;
}

export const osDocuments = [
  { path: "/licenses", label: "ライセンス.txt" },
  { path: "/terms", label: "利用規約.txt" },
  { path: "/privacy", label: "プライバシーポリシー.txt" },
];

export function getOsPage(pathname: string) {
  pathname = pathname.replace(/\/+$/, "") || "/";
  if (pathname === "/") return null;
  if (pathname === "/lab") return { ...labApp, title: labApp.label };
  if (pathname === "/console") return { ...consoleApp, title: consoleApp.label };
  if (pathname === "/notepad") return { ...notepadApp, title: notepadApp.label };
  const document = osDocuments.find((item) => item.path === pathname);
  if (document) return { ...getOsApp("documents"), title: "ドキュメント" };
  const app = osApps.find((item) => item.path === pathname || (item.id === "settings" && pathname.startsWith("/settings/")));
  if (app) return { ...app, title: app.label };
  const child = childApps.find(app => pathname === app.path || pathname.startsWith(app.path + "/"));
  if (child) return { ...child, title: `${getOsApp(child.parent).label}｜${child.label}` };
  return { ...systemApp, title: systemApp.label };
}

export function isOsPath(pathname: string) {
  pathname = pathname.replace(/\/+$/, "") || "/";
  return !/^\/(?:api(?:\/|$)|auth(?:\/|$)|map(?:\/|$)|home-control(?:\/|$)|apply(?:\/|$)|wsolver(?:\/|$))/.test(pathname);
}
