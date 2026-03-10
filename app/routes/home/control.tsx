import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import { type LoaderFunctionArgs } from "react-router";
import { NotFoundPage } from "../$";
import { PageLayout } from "~/components/layout/PageLayout";
import { PageIntro } from "~/components/layout/PageIntro";
import type { HomeControlActionResult, PcStatePayload } from "~/utils/home-control";
import { redirectHomeControlSubpathToRoot, requireHomeControlHost } from "~/utils/home-host";
import { siteConfig } from "~/utils/site";

const DEFAULT_STATE: PcStatePayload = {
  power: "unknown",
  canWake: false,
  canShutdown: false,
  source: "none",
  checkedAt: "",
  message: "状態を取得していません。",
};

export const meta = () => {
  return [
    { title: `Home Control | ${siteConfig.fullName}` },
    { name: "description", content: "自宅PCの状態確認と電源操作を行う管理ページ" },
    { name: "robots", content: "noindex, nofollow" },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  requireHomeControlHost(request);
  redirectHomeControlSubpathToRoot(request);
  return null;
}

function formatCheckedAt(value: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(date);
}

function formatUptime(seconds?: number) {
  if (!Number.isFinite(seconds)) return "-";
  const total = Math.max(0, Math.floor(seconds ?? 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

function statusLabel(power: PcStatePayload["power"]) {
  if (power === "on") return "Online";
  if (power === "off") return "Offline";
  return "Unknown";
}

function statusClass(power: PcStatePayload["power"]) {
  if (power === "on") return "status-pill--online";
  if (power === "off") return "status-pill--offline";
  return "status-pill--unknown";
}

export function HomeControlPage() {
  const [state, setState] = useState<PcStatePayload>(DEFAULT_STATE);
  const [loadingState, setLoadingState] = useState(true);
  const [actionPending, setActionPending] = useState<"wake" | "shutdown" | null>(null);
  const [actionMessage, setActionMessage] = useState<string>("");

  const checkedAtText = useMemo(() => formatCheckedAt(state.checkedAt), [state.checkedAt]);
  const uptimeText = useMemo(() => formatUptime(state.uptimeSec), [state.uptimeSec]);

  useEffect(() => {
    let active = true;

    const loadState = async (silent = false) => {
      if (!silent) {
        setLoadingState(true);
      }
      try {
        const response = await fetch("/api/home/status", {
          headers: { Accept: "application/json" },
          cache: "no-store",
        });
        const data = (await response.json()) as PcStatePayload;
        if (!active) return;
        setState(data);
      } catch {
        if (!active) return;
        setState({
          ...DEFAULT_STATE,
          checkedAt: new Date().toISOString(),
          message: "Cloudflare APIから状態を取得できませんでした。",
        });
      } finally {
        if (active) {
          setLoadingState(false);
        }
      }
    };

    void loadState();
    const intervalId = window.setInterval(() => {
      void loadState(true);
    }, 15000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, []);

  const refreshState = async () => {
    setLoadingState(true);
    try {
      const response = await fetch("/api/home/status", {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      const data = (await response.json()) as PcStatePayload;
      setState(data);
    } catch {
      setState({
        ...DEFAULT_STATE,
        checkedAt: new Date().toISOString(),
        message: "Cloudflare APIから状態を取得できませんでした。",
      });
    } finally {
      setLoadingState(false);
    }
  };

  const triggerAction = async (path: "/api/home/wake" | "/api/home/shutdown", action: "wake" | "shutdown") => {
    setActionPending(action);
    setActionMessage("");
    try {
      const response = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const data = (await response.json()) as HomeControlActionResult;
      setActionMessage(data.message ?? (data.ok ? "完了しました。" : "失敗しました。"));
      await refreshState();
    } catch {
      setActionMessage("リクエストに失敗しました。");
    } finally {
      setActionPending(null);
    }
  };

  const handleShutdown = async () => {
    const confirmed = window.confirm("PCをシャットダウンします。続行しますか？");
    if (!confirmed) return;
    await triggerAction("/api/home/shutdown", "shutdown");
  };

  return (
    <PageLayout contentClassName="page-stack">
      <PageIntro
        title="Home Control"
        description="自宅PCの状態確認と電源操作だけを先に実装した管理ページです。"
      />

      <section className="tool-layout">
        <div className="tool-grid">
          <section className="control-panel">
            <div className="panel-heading">
              <h2 className="solver-section-title">PC Status</h2>
              <button
                type="button"
                onClick={() => void refreshState()}
                className="site-button site-button--ghost site-button--small"
              >
                再取得
              </button>
            </div>

            <div className="metric-grid">
              <div className="metric-card">
                <div className="metric-card__label">状態</div>
                <div className="metric-card__badge">
                  <span className={`status-pill ${statusClass(state.power)}`}>
                    {statusLabel(state.power)}
                  </span>
                </div>
              </div>
              <div className="metric-card">
                <div className="metric-card__label">最終確認</div>
                <div className="metric-card__value metric-card__value--small">{checkedAtText}</div>
              </div>
              <div className="metric-card">
                <div className="metric-card__label">稼働時間</div>
                <div className="metric-card__value metric-card__value--small">{uptimeText}</div>
              </div>
            </div>

            <div className="info-stack">
              <div className="info-row">
                <span className="info-row__label">取得元</span>
                <span className="info-row__value info-row__value--caps">{state.source}</span>
              </div>
              <div className="info-row">
                <span className="info-row__label">ホスト名</span>
                <span className="info-row__value">{state.hostname ?? "-"}</span>
              </div>
              <div className="info-row info-row--copy">
                <span className="info-row__copy">
                  {loadingState ? "状態を取得しています..." : (state.message ?? "Cloudflare経由でHome Agentの状態を確認します。")}
                </span>
              </div>
            </div>
          </section>

          <section className="control-panel">
            <div className="control-panel__intro">
              <h2 className="solver-section-title">Power Actions</h2>
              <p className="content-panel__copy">
                PCがオフのときは起動だけ有効です。シャットダウンは Home Agent 経由で送信します。
              </p>
            </div>

            <div className="control-actions">
              <button
                type="button"
                onClick={() => void triggerAction("/api/home/wake", "wake")}
                disabled={!state.canWake || actionPending !== null}
                className="site-button site-button--success"
              >
                {actionPending === "wake" ? "起動リクエスト送信中..." : "PC ON"}
              </button>

              <button
                type="button"
                onClick={() => void handleShutdown()}
                disabled={!state.canShutdown || actionPending !== null}
                className="site-button site-button--danger"
              >
                {actionPending === "shutdown" ? "シャットダウン送信中..." : "PC OFF"}
              </button>

              <a
                href="https://remotedesktop.google.com/access"
                target="_blank"
                rel="noopener noreferrer"
                className="site-button"
              >
                Chrome Remote Desktop
              </a>
            </div>

            <div className="empty-card">
              {actionMessage || "操作結果はここに表示されます。"}
            </div>
          </section>
        </div>
      </section>
    </PageLayout>
  );
}

export function ErrorBoundary() {
  return <NotFoundPage />;
}

export default HomeControlPage;
