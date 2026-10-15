import { Link, useNavigate } from "~/framework/navigation";
import { PageLayout } from "~/components/layout/PageLayout";
import { PixelIcon } from "~/components/os/PixelIcon";
import { siteConfig } from "~/utils/site";
import { useContext, useEffect } from "react";
import { OsOpenAppContext, OsDeveloperContext } from "~/components/os/OsContext";
import { getOsApp } from "~/utils/os";
import changelog from "../../../changelog.md?raw";
import { parseChangelog } from "~/utils/changelog";
import { osVersion, osBuild } from "~/utils/os-version";

const history = parseChangelog(changelog);

export const meta = () => [{ title: `設定 | ${siteConfig.fullName}` }];

export default function SettingsPage({ view = "index" }: { view?: "index" | "about" | "history" | "developer" }) {
  const openApp = useContext(OsOpenAppContext);
  const developer = useContext(OsDeveloperContext);
  const unlocked = developer.presses === 7;
  const navigate = useNavigate();
  useEffect(() => { if (view === "developer" && !unlocked) void navigate("/settings/about"); }, [view, unlocked]);
  return <PageLayout contentClassName={`os-settings-page${view === "index" ? " os-settings-page--index" : ""}`}>
    {view === "index" && <nav className="os-settings-menu" aria-label="設定項目">
      <Link to="/settings/about"><span>このOSについて</span><Chevron /></Link>
      <Link to="/settings/history"><span>更新履歴</span><Chevron /></Link>
      <Link to="/console" onClick={event => openApp?.(getOsApp("console"), event)}><span>コンソール</span><Chevron /></Link>
      {unlocked && <Link to="/settings/developer"><span>開発者向けオプション</span><Chevron /></Link>}
    </nav>}
    <nav className="os-settings-tabs" aria-label="設定項目">
      <Link to="/settings/about" className={view !== "history" && view !== "developer" ? "active" : ""} aria-current={view !== "history" && view !== "developer" ? "page" : undefined}>全般</Link>
      <Link to="/settings/history" className={view === "history" ? "active" : ""} aria-current={view === "history" ? "page" : undefined}>更新履歴</Link>
      {unlocked && <Link to="/settings/developer" className={view === "developer" ? "active" : ""} aria-current={view === "developer" ? "page" : undefined}>開発者向けオプション</Link>}
    </nav>
    <section className="os-settings-pane" aria-label={view === "history" ? "更新履歴" : view === "developer" && unlocked ? "開発者向けオプション" : "このOSについて"}>
      {view === "history" ? <div className="os-settings-history">
        {history.map((entry, index) => <section className="os-settings-release" key={index}>
          <header><h2>{entry.version} <span className="os-settings-version">(Build {entry.build})</span></h2><time dateTime={entry.date}>{entry.date.replace(/^(\d+)-(\d+)-(\d+)$/, "$1年$2月$3日")}</time></header>
          <ul>{entry.changes.map((change, i) => <li key={i}>{change.split(/([ァ-ヶー]+)/).map((part, j) => /^[ァ-ヶー]+$/.test(part) ? <span className="os-settings-word" key={j}>{part}</span> : part)}</li>)}</ul>
        </section>)}
      </div> : view === "developer" && unlocked ? <div className="os-developer-options">
        <button type="button" className="os-developer-log btn site-button" onClick={() => developer.runCommand("type C:\\Logs\\system.log")}>システムログを表示</button>
        <dl className="os-developer-details">
          <div><dt>旧文字コード</dt><dd>Shift_JIS（読み取りのみ）</dd></div>
          <div><dt>移行の検証</dt><dd><code>C:\ROS3U\Tools\relcheck.exe</code><button type="button" className="btn site-button" onClick={() => developer.runCommand("C:\\ROS3U\\Tools\\relcheck.exe")}>実行</button></dd></div>
          <div><dt>開発者コンソール（公開用）</dt><dd><span>{developer.registration ? "移行の検証が完了しました" : "移行の検証が完了すると有効になります"}</span><button type="button" className="btn site-button" disabled={!developer.registration} onClick={() => developer.runCommand("", "developer")}>起動</button></dd></div>
        </dl>
      </div> : <>
        <div className="os-settings-brand"><PixelIcon kind="settings" /><h1 className="os-brand">R <span className="os-brand__accent">OS</span>.3u</h1></div>
        <dl className="os-settings-details">
          <div><dt>システム</dt><dd>R OS.3u</dd></div>
          <div><dt>バージョン</dt><dd><span className="os-settings-version">Version {osVersion}</span>{" "}<button type="button" className="os-settings-version os-settings-build" aria-label={`ビルド番号 ${osBuild}`} onClick={developer.pressBuild}>(Build {osBuild})</button></dd></div>
          <div><dt>開発者</dt><dd>{siteConfig.owner}</dd></div>
        </dl>
        <p className="os-settings-build-status" role="status">{developer.presses >= 7 ? "開発者向けオプションを有効にしました" : developer.presses >= 2 ? `開発者向けオプションまであと${7 - developer.presses}回` : ""}</p>
      </>}
    </section>
  </PageLayout>;
}

function Chevron() {
  return <svg className="os-settings-chevron" viewBox="0 0 8 12" shapeRendering="crispEdges" aria-hidden="true"><path fill="currentColor" d="M1 1h2v2h2v2h2v2H5v2H3v2H1V9h2V7h2V5H3V3H1z" /></svg>;
}
