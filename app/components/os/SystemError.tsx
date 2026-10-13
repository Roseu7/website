import { useContext, useEffect, useId, useRef } from "react";
import { Link } from "~/framework/navigation";
import { siteConfig } from "~/utils/site";
import { OsCloseAppContext, OsWindowActiveContext } from "./OsContext";

export function errorStatus(error: unknown) {
  const status = error && typeof error === "object" && "status" in error ? error.status : undefined;
  return typeof status === "number" && status >= 400 && status <= 599 ? status : 500;
}

export function StopScreen({ status = 404 }: { status?: number }) {
  const screen = useRef<HTMLElement>(null);
  useEffect(() => { screen.current?.focus({ preventScroll: true }); }, []);
  const missing = status === 404;
  const code = missing ? "ROUTE_NOT_FOUND" : status === 503 ? "SERVICE_UNAVAILABLE" : status === 504 ? "UPSTREAM_TIMEOUT" : status === 502 ? "BAD_GATEWAY" : "SERVER_SYSTEM_FAILURE";
  const module = missing ? "ROUTE.SYS" : "SERVER.SYS";
  const detail = missing ? "Requested route not found." : status === 503 ? "Service temporarily unavailable." : status === 504 ? "Upstream request timed out." : status === 502 ? "Invalid upstream response." : "The server encountered an internal error.";
  const stop = `0x${status.toString(16).toUpperCase().padStart(8, "0")}`;
  return <>
    <title>{`${missing ? "404 Not Found" : `${status} ${code}`} | ${siteConfig.fullName}`}</title>
    <meta name="robots" content="noindex, nofollow" />
    <main ref={screen} className="os-error-screen" id="main-content" lang="en" tabIndex={-1}>
      <div className="os-error-screen__content">
        <p className="os-error-screen__desktop">A system error has occurred in R OS.3u.<br />{module} {missing ? "was unable to resolve the requested address." : "was unable to complete the requested operation."}</p>
        <p className="os-error-screen__mobile">A system error has occurred in <span className="os-error-screen__brand">R OS.3u.</span></p>
        <h1>{code}</h1>
        <p className="os-error-screen__desktop">{missing ? "Check the destination address. If this Stop screen appears again," : "The server stopped responding. If this Stop screen appears again,"}<br />{missing ? "return to the desktop and open the application from there." : "wait a moment, then return to the desktop and try again."}</p>
        <p className="os-error-screen__mobile">{missing ? "Return to the Home screen and open the application again." : "Wait a moment, then return to the Home screen and try again."}</p>
        <div className="os-error-screen__technical">
          <p className="os-error-screen__desktop">Technical information:</p>
          <p className="os-error-screen__code"><span>*** STOP: {stop}</span>{" "}<wbr /><span className="os-error-screen__desktop">({stop}, 0x00000000, 0x00000000, 0x00000000)</span></p>
          <p className="os-error-screen__module"><span>*** {module}</span>{" "}<wbr /><span className="os-error-screen__desktop">- Address F0000{status}, base at F0000000, DateStamp 00000300</span></p>
        </div>
        <p className="os-error-screen__http">HTTP {status} - {detail}</p>
        <Link to="/" className="os-error-screen__home" lang="ja">ホームに戻る</Link>
      </div>
    </main>
  </>;
}

export function SystemErrorDialog({ status }: { status: number }) {
  const active = useContext(OsWindowActiveContext);
  const close = useContext(OsCloseAppContext);
  const titleId = useId();
  const confirm = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (active) confirm.current?.focus({ preventScroll: true }); }, [status, active]);
  const denied = status === 401 || status === 403;
  const title = denied ? "アクセスが拒否されました" : status === 429 ? "要求が多すぎます" : "要求を処理できませんでした";
  return <section className="os-page-content os-system-error" role="alert" aria-labelledby={titleId}>
    {active && <><title>{`${status} | ${siteConfig.fullName}`}</title><meta name="robots" content="noindex, nofollow" /></>}
    <div className="os-system-error__message">
      <span className="os-system-error__symbol" aria-hidden="true"><svg viewBox="0 0 16 16" shapeRendering="crispEdges"><path fill="currentColor" d="M3 3h2v2h2v2h2V5h2V3h2v2h-2v2H9v2h2v2h2v2h-2v-2H9V9H7v2H5v2H3v-2h2V9h2V7H5V5H3z" /></svg></span>
      <div><h1 id={titleId}>{denied ? <><span className="os-system-error__title-part">アクセスが</span><wbr /><span className="os-system-error__title-part">拒否されました</span></> : title}</h1>
        <p>{denied ? status === 401 ? "この操作には、アカウントでのログインが必要です。" : "この操作には、アクセス権限が必要です。" : status === 429 ? "時間をおいて、もう一度お試しください。" : "入力内容や操作先を確認して、もう一度お試しください。"}</p>
        <p className="os-system-error__code" lang="en">HTTP {status}<br />{denied ? "ACCESS_DENIED — AUTH.SYS" : "REQUEST_REJECTED — REQUEST.SYS"}</p>
      </div>
    </div>
    <button ref={confirm} type="button" className="btn site-button os-system-error__ok" onClick={close}>OK</button>
  </section>;
}
