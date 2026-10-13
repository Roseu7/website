import { useEffect, useRef, useState, type ReactNode, type MouseEvent } from "react";
import { Link, useNavigate } from "~/framework/navigation";
import { useRouterState } from "@tanstack/react-router";
import { getOsApp, getOsHomePath, getOsPage, isOsPath, osApps, type OsApp } from "~/utils/os";
import { PixelIcon } from "./PixelIcon";
import { OsWindow } from "./OsWindow";
import { OsOpenAppContext, OsPageContext } from "./OsContext";
import { animateOsWindow, stopOsMotion, type OsOpening } from "./motion";

type Task = { id: OsApp["id"]; path: string };
type OpenWindow = Task & { content: ReactNode; error: boolean; minimized: boolean; maximized: boolean; order: number };

function Brand() {
  return <span className="os-brand">R <span className="os-brand__accent">OS</span>.3u</span>;
}

function AppLabel({ app }: { app: OsApp }) {
  if (app.id === "projects") return <><span className="os-project-name">プロジェクト</span><wbr /><span className="os-file-extension">.pdf</span></>;
  if (app.id === "settings") return <><span className="os-label--desktop">システム</span><span className="os-label--mobile">設定</span></>;
  if (app.id === "console") return <><span className="os-label--desktop">コマンド プロンプト</span><span className="os-label--mobile">コンソール</span></>;
  return <>{app.label}</>;
}

function LocalClock() {
  const [time, setTime] = useState("");
  useEffect(() => {
    let timer: number;
    const update = () => {
      window.clearTimeout(timer);
      const now = new Date();
      setTime(`${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`);
      timer = window.setTimeout(update, 60_000 - now.getSeconds() * 1_000 - now.getMilliseconds());
    };
    const onVisible = () => { if (!document.hidden) update(); };
    update();
    document.addEventListener("visibilitychange", onVisible);
    return () => { window.clearTimeout(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, []);
  return <time className="os-clock" dateTime={time || undefined} title="端末のローカル時刻">{time || "--:--"}</time>;
}

function AppLink({ app, path = app.path, onOpen, shortcut = false }: { app: OsApp; path?: string; onOpen?: (event: MouseEvent<HTMLAnchorElement>) => void; shortcut?: boolean }) {
  return (
    <Link to={path} className="os-app-icon" onClick={onOpen}>
      <span className="os-app-icon__graphic"><PixelIcon kind={app.icon} />{shortcut && <svg className="os-shortcut" viewBox="0 0 8 8" shapeRendering="crispEdges" aria-hidden="true" focusable="false"><path fill="#5022c4" d="M0 0h8v8H0z" /><path fill="#fff8ff" d="M1 1h6v6H1z" /><path fill="#3d2166" d="M2 2h4v4H5V4H4v1H3v1H2V4h1V3H2z" /></svg>}</span>
      <span className="os-app-icon__label"><AppLabel app={app} /></span>
    </Link>
  );
}

export function OsShell({ enabled, children, notFound = false, systemError = false }: { enabled: boolean; children: ReactNode; notFound?: boolean; systemError?: boolean }) {
  const location = useRouterState({ select: state => {
    const match = state.matches[state.matches.length - 1];
    // Match and page advance together; location can change before/after lazy route loading.
    return { pathname: match.pathname, key: match.id };
  } });
  const navigate = useNavigate();
  const active = enabled && (systemError || isOsPath(location.pathname));
  const page = active && !notFound ? getOsPage(location.pathname) : null;
  const [tasks, setTasks] = useState<OpenWindow[]>(() => page ? [{ id: page.id, path: location.pathname, content: children, error: systemError, minimized: false, maximized: false, order: 1 }] : []);
  const nextOrder = useRef(1);
  const [history, setHistory] = useState<Task[]>(() => page ? [{ id: page.id, path: location.pathname }] : []);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [startOpen, setStartOpen] = useState(false);
  const [startClosing, setStartClosing] = useState(false);
  const [opening, setOpening] = useState<(OsOpening & { app: OsApp["id"] }) | null>(null);
  const openingSerial = useRef(0);
  const shellRef = useRef<HTMLDivElement>(null);
  const startButtonRef = useRef<HTMLButtonElement>(null);
  const startPanelRef = useRef<HTMLElement>(null);
  const homeFrames = useRef<HTMLElement[]>([]);
  const homeSerial = useRef(0);
  const locationRef = useRef(location.pathname);
  const tasksRef = useRef(tasks);
  locationRef.current = location.pathname;
  tasksRef.current = tasks;
  const lastTap = useRef<number | null>(null);
  const homeButtonRef = useRef<HTMLButtonElement>(null);
  const historyRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 760px)");
    const update = () => setMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let dark = false;
    if (!active) {
      dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      try {
        const saved = localStorage.getItem("theme");
        if (saved !== null) dark = saved === "dark";
      } catch { /* Storage access is optional for the legacy theme. */ }
    }
    document.documentElement.classList.toggle("dark", dark);
  }, [active, enabled]);

  useEffect(() => {
    if (!active || notFound) return;
    closeStart();
    if (!page) {
      setTasks((current) => current.map((task) => task.minimized ? task : { ...task, minimized: true }));
      return;
    }
    lastTap.current = null;
    const task = { id: page.id, path: location.pathname };
    setTasks((current) => {
      const order = ++nextOrder.current;
      const existing = current.find((item) => item.id === task.id);
      const updated = { ...existing, ...task, content: children, error: systemError, minimized: false, maximized: systemError ? false : existing?.maximized ?? false, order };
      return existing ? current.map((item) => item.id === task.id ? updated : item) : [...current, updated];
    });
    setHistory((current) => [task, ...current.filter((item) => item.id !== task.id)]);
    setHistoryOpen(false);
  }, [active, notFound, systemError, location.pathname, location.key]);

  // The root supplies a matched page with scoped loader data for each retained category.
  const windows = page && !tasks.some((task) => task.id === page.id)
    ? [...tasks, { id: page.id, path: location.pathname, content: children, error: systemError, minimized: false, maximized: false, order: nextOrder.current + 1 }]
    : tasks;
  const maximized = windows.some((task) => !task.minimized && task.maximized);
  const mobileDialog = mobile && systemError && !notFound;
  const errorBackground = mobileDialog ? windows.filter(task => task.id !== page?.id && !task.error && !task.minimized).sort((a, b) => b.order - a.order)[0]?.id : undefined;

  useEffect(() => {
    if (historyOpen) historyRef.current?.querySelector<HTMLAnchorElement>("a")?.focus({ preventScroll: true });
  }, [historyOpen]);

  useEffect(() => {
    if (!historyOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setHistoryOpen(false);
        homeButtonRef.current?.focus();
      }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [historyOpen]);

  useEffect(() => {
    if (!startOpen) return;
    startPanelRef.current?.querySelector<HTMLAnchorElement>("a")?.focus();
    const outside = (event: Event) => {
      const target = event.target as Node;
      if (!startPanelRef.current?.contains(target) && !startButtonRef.current?.contains(target)) closeStart();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { closeStart(); startButtonRef.current?.focus(); }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("focusin", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("focusin", outside); document.removeEventListener("keydown", escape); };
  }, [startOpen]);

  function closeStart() {
    if (startOpen && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) setStartClosing(true);
    setStartOpen(false);
  }

  function cancelHome() {
    homeSerial.current++;
    homeFrames.current.forEach(stopOsMotion);
    homeFrames.current = [];
  }

  function rememberOpening(app: OsApp, event: MouseEvent<HTMLAnchorElement>) {
    if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    cancelHome();
    const existing = tasksRef.current.find((task) => task.id === app.id);
    if (existing && !existing.minimized) {
      const frame = shellRef.current?.querySelector<HTMLElement>(`.os-window[data-app="${app.id}"]`);
      if (frame) { stopOsMotion(frame); frame.style.visibility = ""; }
      setOpening(null);
      setTasks((current) => current.map((task) => task.id === app.id ? { ...task, order: ++nextOrder.current } : task));
      if (location.pathname === event.currentTarget.pathname) {
        event.preventDefault();
        const content = shellRef.current?.querySelector<HTMLElement>(`#os-content-${app.id}`);
        if (content) { content.scrollTop = 0; content.focus({ preventScroll: true }); }
      }
    } else {
      const source = event.currentTarget.querySelector<HTMLElement>(".os-app-icon__graphic, .os-pixel-icon") ?? event.currentTarget;
      setOpening({ app: app.id, origin: source.getBoundingClientRect(), serial: ++openingSerial.current });
    }
    setHistoryOpen(false);
    closeStart();
  }

  function minimizeTarget(task: Task) {
    const mobile = window.innerWidth <= 760;
    const selector = mobile ? `#os-apps a[href="${getOsHomePath(task.id)}"] .os-app-icon__graphic` : `.os-task[href="${task.path}"]`;
    const target = shellRef.current?.querySelector<HTMLElement>(selector) ?? (mobile ? null : startButtonRef.current);
    // Direct-only pages have no home icon to animate toward.
    return target?.getBoundingClientRect() ?? { x: 0, y: 0, width: 0, height: 0 };
  }

  function openHistory() {
    if (!homeFrames.current.length && location.pathname !== "/") { goHome(true); return; }
    cancelHome();
    setHistoryOpen(true);
    if (location.pathname !== "/") void navigate("/");
  }

  function goHome(showHistory = false) {
    cancelHome();
    setHistoryOpen(false);
    closeStart();
    const serial = homeSerial.current;
    const frames = Array.from(shellRef.current?.querySelectorAll<HTMLElement>(".os-window") ?? []).filter((frame) => frame.getBoundingClientRect().width > 0);
    homeFrames.current = frames;
    let remaining = frames.length;
    const commit = () => {
      if (serial !== homeSerial.current) return;
      homeFrames.current = [];
      setHistoryOpen(showHistory);
      setTasks((current) => current.map((task) => ({ ...task, minimized: true })));
      if (locationRef.current !== "/") void navigate("/");
      if (window.innerWidth <= 760) homeButtonRef.current?.focus({ preventScroll: true });
      else startButtonRef.current?.focus({ preventScroll: true });
    };
    if (!remaining) commit();
    for (const frame of frames) {
      const task = tasksRef.current.find((item) => item.id === frame.dataset.app)!;
      animateOsWindow(frame, minimizeTarget(task), true, () => { if (--remaining === 0) commit(); });
    }
  }

  function focusWindow(task: OpenWindow) {
    if (page?.id === task.id && !task.minimized) return;
    setTasks((current) => current.map((item) => item.id === task.id ? { ...item, minimized: false, order: ++nextOrder.current } : item));
    if (location.pathname !== task.path) void navigate(task.path);
  }

  function dismissWindow(task: OpenWindow, close: boolean) {
    const commit = () => {
      setTasks((current) => close ? current.filter((item) => item.id !== task.id) : current.map((item) => item.id === task.id ? { ...item, minimized: true } : item));
      if (getOsPage(locationRef.current)?.id !== task.id) return;
      const next = tasksRef.current.filter((item) => item.id !== task.id && !item.minimized).sort((a, b) => b.order - a.order)[0];
      void navigate(next?.path ?? "/");
    };
    const frame = shellRef.current?.querySelector<HTMLElement>(`.os-window[data-app="${task.id}"]`);
    if (close || !frame) { if (frame) stopOsMotion(frame); commit(); }
    else animateOsWindow(frame, minimizeTarget(task), true, commit);
  }

  if (!active && !notFound) return <OsPageContext.Provider value={false}>{children}</OsPageContext.Provider>;

  return (
    <OsPageContext.Provider value><OsOpenAppContext.Provider value={rememberOpening}>
      <div ref={shellRef} className={`os-shell${historyOpen ? " os-shell--history" : ""}`} hidden={notFound} inert={notFound}>
        <a className="os-skip-link" href={page ? `#os-content-${page.id}` : "#os-apps"}>内容へ移動</a>
        <div className="os-mobile-status" role="group" aria-label="仮想OSのステータスバー">
          <div className="os-mobile-status__network"><svg viewBox="0 0 18 14" shapeRendering="crispEdges" aria-hidden="true"><path fill="currentColor" d="M0 10h2v4H0zM4 8h2v6H4zM8 6h2v8H8zM12 3h2v11h-2zM16 0h2v14h-2z" /></svg><span>R OS.3u</span><svg viewBox="0 0 18 14" shapeRendering="crispEdges" role="img" aria-label="Wi-Fi接続"><path fill="currentColor" d="M4 1h10v1h2v1h2v2h-2V4h-2V3H4v1H2v1H0V3h2V2h2zM6 5h6v1h2v1h1v2h-2V8h-1V7H6v1H5v1H3V7h1V6h2zM6 10h6v1h-1v1h-1v1H8v-1H7v-1H6z" /></svg></div>
          <LocalClock />
          <div className="os-mobile-status__battery" role="img" aria-label="仮想バッテリー、100%、充電中"><span>100%</span><svg viewBox="0 0 30 18" shapeRendering="crispEdges" aria-hidden="true"><path fill="currentColor" fillRule="evenodd" d="M1 1h26v16H1zM3 3v12h22V3zM27 6h2v6h-2z" /><path fill="currentColor" d="M4 4h20v10H4z" /><path fill="#edddf5" transform="translate(-2 0)" d="M18 3 10 10h6l-3 5 9-8h-6z" /></svg></div>
        </div>
        <main className="os-stage">
          <section className={`os-desktop${page && maximized ? " os-desktop--maximized" : ""}`} aria-label="デスクトップ">
            <div className="os-desktop__brand"><Brand /></div>
            <nav id="os-apps" className="os-app-grid" aria-label="アプリ一覧" inert={historyOpen || (mobile && Boolean(page))} aria-hidden={historyOpen || (mobile && Boolean(page)) || undefined}>
              {osApps.map((app) => <AppLink key={app.id} app={app} shortcut={app.id !== "projects" && app.id !== "settings"} onOpen={(event) => rememberOpening(app, event)} />)}
            </nav>
            <div className="os-desktop__message" inert={page || historyOpen ? true : undefined}>
              <h1>作ってみたいものを<span className="os-desktop__message-line">ちゃんと動く形で残していく。</span></h1>
            </div>
          </section>
          <span className="os-desktop__owner" inert={page || historyOpen ? true : undefined}>© 2026 Roseu</span>

          {mobileDialog && <div className="os-error-shade" aria-hidden="true" />}
          {windows.map((task, index) => <OsWindow key={task.id} path={page?.id === task.id ? location.pathname : task.path} active={page?.id === task.id} error={page?.id === task.id ? systemError : task.error} background={task.id === errorBackground} modal={mobileDialog && page?.id === task.id} minimized={task.minimized} maximized={task.maximized && !(page?.id === task.id ? systemError : task.error)} order={windows.filter((item) => item.order < task.order).length + 1} slot={index} opening={opening?.app === task.id ? opening : undefined} onFocus={() => focusWindow(task)} onMinimize={() => dismissWindow(task, false)} onClose={() => dismissWindow(task, true)} onMaximize={() => {
            setTasks((current) => current.map((item) => item.id === task.id ? { ...item, maximized: !item.maximized } : item));
            focusWindow(task);
          }}>{page?.id === task.id ? children : task.content}</OsWindow>)}
          {!page && !notFound && <div hidden>{children}</div>}
        </main>

        <nav className="os-taskbar" aria-label="タスクバー">
          <button ref={startButtonRef} type="button" className="os-taskbar__home" aria-label="スタート：アプリ一覧" aria-controls="os-start-panel" aria-expanded={startOpen} onClick={() => { if (startOpen) closeStart(); else { setStartClosing(false); setStartOpen(true); } }}><span className="os-start-emblem" aria-hidden="true"><i /><i /><i /><i /></span><span>スタート</span></button>
          <div className="os-taskbar__tasks">
            {tasks.map((task) => {
              const app = getOsApp(task.id);
              return <Link key={task.id} to={task.path} onClick={(event) => {
                if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                if (!task.minimized) {
                  event.preventDefault(); cancelHome(); closeStart();
                  if (page?.id === task.id) dismissWindow(task, false);
                  else focusWindow(task);
                }
                else rememberOpening(app, event);
              }} className={`os-task${page?.id === task.id ? " is-active" : ""}`} aria-current={page?.id === task.id ? "page" : undefined}><PixelIcon kind={app.icon} /><span><AppLabel app={app} /></span></Link>;
            })}
          </div>
          <LocalClock />
        </nav>

        <nav ref={startPanelRef} id="os-start-panel" className={`os-start-panel${startClosing ? " is-closing" : ""}`} aria-label="スタートパネル" hidden={!startOpen && !startClosing} inert={!startOpen} onAnimationEnd={() => { if (startClosing) setStartClosing(false); }}>
          <div className="os-start-panel__brand" aria-hidden="true"><Brand /></div>
          <div className="os-start-panel__items">
            {[...osApps, getOsApp("console")].map((app) => <Link key={app.id} to={app.path} className="os-start-item" onClick={(event) => rememberOpening(app, event)}><PixelIcon kind={app.icon} /><span><AppLabel app={app} /></span></Link>)}
            <button type="button" className="os-start-item os-start-item--desktop" onClick={() => goHome()}><PixelIcon kind="system" /><span>デスクトップを表示</span></button>
          </div>
        </nav>
        <nav id="os-history" ref={historyRef} className="os-history" aria-label="最近使ったアプリ" hidden={!historyOpen}>
          <div className="os-history__icons">
            {history.length === 0 ? <p>まだアプリを開いていません</p> : history.map((item) => <AppLink key={item.id} app={getOsApp(item.id)} path={item.path} onOpen={(event) => rememberOpening(getOsApp(item.id), event)} />)}
          </div>
        </nav>
        <div className="os-mobile-controls">
          <div className="os-home-control"><button ref={homeButtonRef} type="button" className="os-home-button" aria-label="ホームへ戻る。2回タップで最近使ったアプリ" aria-controls="os-history" aria-expanded={historyOpen} onClick={(event) => {
            const now = performance.now();
            if (event.detail > 0 && lastTap.current !== null && now - lastTap.current < 320) { lastTap.current = null; openHistory(); }
            else { lastTap.current = now; goHome(); }
          }}><svg viewBox="0 0 28 28" shapeRendering="crispEdges" aria-hidden="true"><path fill="#3d2166" d="M9 0h10v1h3v2h3v3h2v3h1v10h-1v3h-2v3h-3v2h-3v1H9v-1H6v-2H3v-3H1v-3H0V9h1V6h2V3h3V1h3z" /><path fill="#523d70" d="M9 2h10v1h3v2h2v4h2v10h-2v3h-2v2h-3v2H9v-2H6v-2H4v-3H2V9h2V6h2V4h3z" /><path fill="#847092" d="M9 2h10v1h3v2h2v4h-1V6h-2V4H7v2H5v3H4V5h2V3h3z" /><path fill="#f9e7fa" fillRule="evenodd" d="M10 9h8v1h1v8h-1v1h-8v-1H9v-8h1zM10 10v8h8v-8z" /></svg></button></div>
        </div>
      </div>
      {notFound && children}
    </OsOpenAppContext.Provider></OsPageContext.Provider>
  );
}
