import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigationType } from "~/framework/navigation";
import { getOsPage, osDocuments } from "~/utils/os";
import { OsWindowActiveContext, OsCloseAppContext } from "./OsContext";
import { animateOsWindow, stopOsMotion, type OsOpening, type OsRect } from "./motion";
import { stepOsWheel } from "./scroll";

function WindowControl({ id, label, onClick, pressed, children }: { id: string; label: string; onClick: () => void; pressed?: boolean; children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  const timer = useRef(0);
  const hide = () => { window.clearTimeout(timer.current); setVisible(false); };
  const show = () => {
    hide();
    timer.current = window.setTimeout(() => {
      setVisible(true);
      timer.current = window.setTimeout(hide, 2000);
    }, 500);
  };
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return <span className={`os-control-wrap${visible ? " has-tooltip" : ""}`} onPointerEnter={show} onPointerLeave={hide} onBlur={hide} onFocus={(event) => { if (event.target.matches(":focus-visible")) show(); }} onKeyDown={(event) => { if (event.key === "Escape") hide(); }}>
    <button type="button" aria-label={label} aria-describedby={id} aria-pressed={pressed} onClick={() => { hide(); onClick(); }}>{children}</button>
    <span className="os-tooltip" id={id} role="tooltip">{label}</span>
  </span>;
}

export function OsWindow({ path, active, error, background, modal, minimized, maximized, order, slot, opening, children, onFocus, onMinimize, onMaximize, onClose }: {
  path: string; active: boolean; error: boolean; background: boolean; modal: boolean; minimized: boolean; maximized: boolean; order: number; slot: number; children: ReactNode;
  onFocus: () => void; onMinimize: () => void; onMaximize: () => void; onClose: () => void;
  opening?: OsOpening;
}) {
  const page = getOsPage(path)!;
  const frameRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const position = useRef({ x: 180 + slot * 24, y: 76 + slot * 24 });
  const gesture = useRef<{ x: number; y: number; clientX: number; clientY: number } | null>(null);
  const animation = useRef(0);
  const pendingPosition = useRef<{ x: number; y: number } | null>(null);
  const lastDragFrame = useRef(0);
  const consumedOpening = useRef(0);
  const maximizeOrigin = useRef<OsRect | null>(null);
  const scroll = useRef(new Map<string, number>());
  const navigationType = useNavigationType();

  function place(x: number, y: number) {
    const frame = frameRef.current;
    const stage = frame?.parentElement;
    if (!frame || !stage || !stage.clientWidth || !frame.offsetWidth || window.innerWidth <= 760 || frame.classList.contains("os-window--maximized")) return;
    position.current = {
      x: Math.round(Math.max(0, Math.min(x, stage.clientWidth - frame.offsetWidth - 6))),
      y: Math.round(Math.max(0, Math.min(y, stage.clientHeight - frame.offsetHeight - 6))),
    };
    frame.style.setProperty("--window-x", `${position.current.x}px`);
    frame.style.setProperty("--window-y", `${position.current.y}px`);
  }

  useLayoutEffect(() => {
    const frame = frameRef.current!;
    const stage = frame.parentElement!;
    position.current.x = Math.max(180, stage.clientWidth * .17) + slot * 24;
    place(position.current.x, position.current.y);
    const resize = new ResizeObserver(() => place(position.current.x, position.current.y));
    resize.observe(stage);
    resize.observe(frame);
    return () => { resize.disconnect(); cancelAnimationFrame(animation.current); stopOsMotion(frame); consumedOpening.current = 0; };
  }, []);

  useLayoutEffect(() => {
    const frame = frameRef.current!;
    if (!minimized) frame.style.visibility = "";
    if (active && !minimized && opening && consumedOpening.current !== opening.serial) {
      consumedOpening.current = opening.serial;
      animateOsWindow(frame, opening.origin);
    }
  }, [active, minimized, opening?.serial]);

  useLayoutEffect(() => {
    if (maximizeOrigin.current) {
      animateOsWindow(frameRef.current!, maximizeOrigin.current);
      maximizeOrigin.current = null;
    }
  }, [maximized]);

  function toggleMaximize() {
    if (error || page.id === "settings") return;
    stopOsMotion(frameRef.current!);
    maximizeOrigin.current = frameRef.current!.getBoundingClientRect();
    onMaximize();
  }

  useEffect(() => {
    const content = contentRef.current!;
    content.scrollTop = navigationType === "POP" ? scroll.current.get(path) ?? 0 : 0;
    return () => { scroll.current.set(path, content.scrollTop); };
  }, [path]);

  useEffect(() => {
    if (active && !minimized) {
      const target = error ? contentRef.current?.querySelector<HTMLButtonElement>(".os-system-error__ok") : page.id === "console" ? contentRef.current?.querySelector<HTMLInputElement>(".os-console-input") : contentRef.current;
      target?.focus({ preventScroll: true });
    }
  }, [active, error, minimized, path]);

  useEffect(() => {
    if (active && !minimized) return stepOsWheel(contentRef.current!);
  }, [active, minimized, path]);

  function finishDrag() {
    cancelAnimationFrame(animation.current);
    animation.current = 0;
    gesture.current = null;
    pendingPosition.current = null;
    frameRef.current?.classList.remove("is-dragging");
  }

  return <section ref={frameRef} data-app={page.id} style={{ zIndex: modal ? 101 : order }} className={`os-window${active ? " is-active" : ""}${error ? " os-window--error" : ""}${background ? " os-window--backdrop" : ""}${minimized ? " is-minimized" : ""}${maximized ? " os-window--maximized" : ""}${page.id === "documents" ? " os-window--text" : ""}${page.id === "projects" ? " os-window--pdf" : ""}`} role={error ? "dialog" : undefined} aria-modal={modal || undefined} aria-hidden={background || undefined} inert={background} aria-label={page.title} onKeyDown={event => {
    if (modal && event.key === "Tab") { event.preventDefault(); contentRef.current?.querySelector<HTMLButtonElement>(".os-system-error__ok")?.focus(); }
  }} onPointerDownCapture={(event) => {
    if (!(event.target as Element).closest(".os-window-controls")) onFocus();
  }} onFocusCapture={(event) => {
    if (!(event.target as Element).closest(".os-window-controls")) onFocus();
  }}>
    <header className="os-titlebar" onDoubleClick={(event) => {
      if (!(event.target as Element).closest(".os-window-controls") && window.innerWidth > 760) toggleMaximize();
    }} onPointerDown={(event) => {
      if (event.button !== 0 || maximized || !window.matchMedia("(min-width: 761px)").matches || (event.target as Element).closest(".os-window-controls")) return;
      event.preventDefault();
      stopOsMotion(frameRef.current!);
      event.currentTarget.setPointerCapture(event.pointerId);
      gesture.current = { ...position.current, clientX: event.clientX, clientY: event.clientY };
      lastDragFrame.current = performance.now();
      frameRef.current?.classList.add("is-dragging");
    }} onPointerMove={(event) => {
      const start = gesture.current;
      if (!start) return;
      const x = start.x + event.clientX - start.clientX;
      const y = start.y + event.clientY - start.clientY;
      pendingPosition.current = { x, y };
      if (animation.current) return;
      const tick = (timestamp: number) => {
        if (timestamp - lastDragFrame.current >= 1000 / 30) {
          const pending = pendingPosition.current;
          if (pending) place(pending.x, pending.y);
          lastDragFrame.current = timestamp - ((timestamp - lastDragFrame.current) % (1000 / 30));
          animation.current = 0;
        } else animation.current = requestAnimationFrame(tick);
      };
      animation.current = requestAnimationFrame(tick);
    }} onPointerUp={(event) => {
      const start = gesture.current;
      if (start) place(start.x + event.clientX - start.clientX, start.y + event.clientY - start.clientY);
      finishDrag();
    }} onPointerCancel={finishDrag} onLostPointerCapture={finishDrag}>
      <button type="button" className="os-titlebar__name os-titlebar__name--desktop" title={error || page.id === "settings" ? "ドラッグ、または矢印キーで移動。" : "ドラッグ、または矢印キーで移動。ダブルクリックで最大化。"} onKeyDown={(event) => {
        if (maximized || !window.matchMedia("(min-width: 761px)").matches) return;
        const step = event.shiftKey ? 64 : 16;
        const delta = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[event.key];
        if (delta) { event.preventDefault(); place(position.current.x + delta[0], position.current.y + delta[1]); }
        if (event.key === "Home") { event.preventDefault(); place(180, 76); }
      }}><span className="os-titlebar__mark" aria-hidden="true" /><span>{page.id === "settings" ? "システム" : page.title}</span></button>
      {!error && page.id === "settings" && path !== "/settings" && <Link to="/settings" className="os-settings-back" aria-label="設定に戻る"><svg className="os-settings-back__edge" viewBox="0 0 56 44" preserveAspectRatio="none" aria-hidden="true"><path d="M11 1H51Q55 1 55 5V39Q55 43 51 43H11L1 22Z" fill="none" stroke="var(--ink-2)" strokeWidth="1" vectorEffect="non-scaling-stroke" /><path d="M11.5 2H51Q54 2 54 5M11 2L2 22" fill="none" stroke="var(--os-light)" strokeWidth="1" vectorEffect="non-scaling-stroke" /></svg>設定</Link>}
      <div className="os-titlebar__name os-titlebar__name--mobile"><span className="os-titlebar__mark" aria-hidden="true" /><span>{page.id === "console" ? "コンソール" : page.id === "projects" ? "プロジェクト" : page.id === "settings" && path === "/settings/about" ? "このOSについて" : page.id === "settings" && path === "/settings/history" ? "更新履歴" : page.title}</span></div>
      <div className="os-window-controls" data-ui-actions>
        {!error && page.id !== "settings" && <>
        <WindowControl id={`os-${page.id}-min-tooltip`} label="最小化" onClick={onMinimize}><span className="os-control-min" aria-hidden="true" /></WindowControl>
        <WindowControl id={`os-${page.id}-max-tooltip`} label={maximized ? "元のサイズに戻す" : "最大化"} pressed={maximized} onClick={toggleMaximize}>{maximized ? <svg className="os-control-restore" viewBox="0 0 16 16" shapeRendering="crispEdges" aria-hidden="true"><path fill="currentColor" d="M5 1h10v10H5z" /><path fill="var(--os-face)" d="M7 4h6v5H7zM2 6h8v8H2z" /><path fill="currentColor" fillRule="evenodd" d="M1 5h10v10H1zM3 8v5h6V8z" /></svg> : <span className="os-control-max" aria-hidden="true" />}</WindowControl>
        </>}
        <WindowControl id={`os-${page.id}-close-tooltip`} label="閉じる" onClick={onClose}><svg width="16" height="16" viewBox="0 0 16 16" shapeRendering="crispEdges" aria-hidden="true"><path fill="currentColor" d="M2 2h2v2h2v2h2V4h2V2h2v2h-2v2H8v2h2v2h2v2h-2v-2H8V8H6v2H4v2H2v-2h2V8h2V6H4V4H2z" /></svg></WindowControl>
      </div>
    </header>
    {!error && page.id === "documents" && <nav className="os-document-tabs" aria-label="文書一覧" inert={!active}>{osDocuments.map((item) => <Link key={item.path} to={item.path} className={path === item.path ? "active" : ""} aria-current={path === item.path ? "page" : undefined}><span className="os-document-tab-label">{item.path === "/privacy" ? <>プライバシー<wbr />ポリシー<wbr /><span className="os-document-extension">.txt</span></> : <>{item.label.slice(0, -4)}<wbr /><span className="os-document-extension">.txt</span></>}</span></Link>)}</nav>}
    <div id={`os-content-${page.id}`} ref={contentRef} className="os-window-content" tabIndex={-1} inert={!active}><OsWindowActiveContext.Provider value={active && !minimized}><OsCloseAppContext.Provider value={onClose}>{children}</OsCloseAppContext.Provider></OsWindowActiveContext.Provider></div>
  </section>;
}
