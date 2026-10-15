import { Link, useNavigate } from "~/framework/navigation";
import { PageLayout } from "~/components/layout/PageLayout";
import { PixelIcon } from "~/components/os/PixelIcon";
import { siteConfig } from "~/utils/site";
import { useContext, useEffect, useState } from "react";
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
  const [buildReaction, setBuildReaction] = useState(0);
  const [localLogTime, setLocalLogTime] = useState(false);
  function pressBuild() { developer.pressBuild(); setBuildReaction(value => value + 1); }
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
        <dl className="os-developer-details">
          <div><dt>システムログ</dt><dd><button type="button" className="btn site-button" onClick={() => developer.runCommand("type C:\\Logs\\system.log", undefined, localLogTime)}>表示</button></dd></div>
          <div><dt>ログの時刻表示</dt><dd><button type="button" className="os-developer-time" onClick={() => setLocalLogTime(value => !value)}>{localLogTime ? "ローカル" : "UTC"}</button></dd></div>
          <div><dt>旧文字コード</dt><dd>Shift_JIS（読み取り専用）</dd></div>
          <div><dt>移行記録の検証</dt><dd><button type="button" className="btn site-button" onClick={() => developer.runCommand("C:\\ROS3U\\Tools\\relcheck.exe")}>実行</button></dd></div>
          <div><dt>公開開発者コンソール</dt><dd>{developer.registration ? <button type="button" className="btn site-button" onClick={() => developer.runCommand("", "developer")}>開く</button> : "無効"}</dd></div>
        </dl>
        {!developer.registration && <p className="os-developer-note">* 移行記録の検証が必要です</p>}
      </div> : <>
        <div className="os-settings-brand"><PixelIcon kind="settings" /><h1 className="os-brand">R <span className="os-brand__accent">OS</span>.3u</h1></div>
        <dl className="os-settings-details">
          <div><dt>システム</dt><dd>R OS.3u</dd></div>
          <div><dt>バージョン</dt><dd><span className="os-settings-version">Version {osVersion}</span>{" "}<span role="button" tabIndex={0} className={`os-settings-version os-settings-build${buildReaction ? ` os-settings-build--shake-${buildReaction % 2}` : ""}`} aria-label={`ビルド番号 ${osBuild}`} onClick={pressBuild} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); pressBuild(); } }}>(Build {osBuild})</span></dd></div>
          <div><dt>開発者</dt><dd>{siteConfig.owner}</dd></div>
        </dl>
      </>}
    </section>
  </PageLayout>;
}

function Chevron() {
  return <svg className="os-settings-chevron" viewBox="0 0 8 12" shapeRendering="crispEdges" aria-hidden="true"><path fill="currentColor" d="M1 1h2v2h2v2h2v2H5v2H3v2H1V9h2V7h2V5H3V3H1z" /></svg>;
}
