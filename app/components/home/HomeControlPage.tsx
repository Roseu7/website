import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PageLayout } from "~/components/layout/PageLayout";
import { PageIntro } from "~/components/layout/PageIntro";
import type { HomeControlActionResult, PcStatePayload } from "~/utils/home/types";

const DEFAULT_STATE: PcStatePayload = {
  power: "unknown",
  canWake: false,
  canShutdown: false,
  source: "none",
  checkedAt: "",
  message: "状態を取得していません。",
};

function isPcState(value: unknown): value is PcStatePayload {
  if (!value || typeof value !== "object") return false;
  const state = value as Record<string, unknown>;
  return ["on", "off", "unknown"].includes(String(state.power))
    && typeof state.canWake === "boolean"
    && typeof state.canShutdown === "boolean"
    && ["home-agent", "derived", "none"].includes(String(state.source))
    && typeof state.checkedAt === "string"
    && (state.hostname === undefined || typeof state.hostname === "string")
    && (state.message === undefined || typeof state.message === "string")
    && (state.uptimeSec === undefined || (typeof state.uptimeSec === "number" && Number.isFinite(state.uptimeSec)));
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
  const statusRequest = useRef<AbortController | null>(null);
  const mounted = useRef(false);
  const actionInFlight = useRef(false);

  const checkedAtText = useMemo(() => formatCheckedAt(state.checkedAt), [state.checkedAt]);
  const uptimeText = useMemo(() => formatUptime(state.uptimeSec), [state.uptimeSec]);

  const refreshState = useCallback(async (silent = false) => {
    if (silent && statusRequest.current) return;
    statusRequest.current?.abort();
    const controller = new AbortController();
    statusRequest.current = controller;
    if (!silent) setLoadingState(true);
    try {
      const response = await fetch("/api/home/status", {
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data: unknown = await response.json();
      if (!isPcState(data)) throw new Error("Invalid status response");
      if (controller.signal.aborted) return;
      setState(data);
    } catch {
      if (controller.signal.aborted) return;
      setState({
        ...DEFAULT_STATE,
        checkedAt: new Date().toISOString(),
        message: "Cloudflare APIから状態を取得できませんでした。",
      });
    } finally {
      if (statusRequest.current === controller) {
        statusRequest.current = null;
        setLoadingState(false);
      }
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void refreshState();
    const intervalId = window.setInterval(() => {
      if (!document.hidden) void refreshState(true);
    }, 15000);
    const onVisibilityChange = () => {
      if (!document.hidden) void refreshState();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      mounted.current = false;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      statusRequest.current?.abort();
      statusRequest.current = null;
    };
  }, [refreshState]);

  const triggerAction = async (path: "/api/home/wake" | "/api/home/shutdown", action: "wake" | "shutdown") => {
    if (actionInFlight.current) return;
    actionInFlight.current = true;
    setActionPending(action);
    setActionMessage("");
    try {
      const response = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const data = (await response.json()) as HomeControlActionResult;
      if (!mounted.current) return;
      if (!data || typeof data.ok !== "boolean" || (data.message !== undefined && typeof data.message !== "string")) {
        throw new Error("Invalid action response");
      }
      setActionMessage(data.message ?? (response.ok && data.ok ? "完了しました。" : "失敗しました。"));
      await refreshState();
    } catch {
      if (mounted.current) setActionMessage("リクエストに失敗しました。");
    } finally {
      actionInFlight.current = false;
      if (mounted.current) setActionPending(null);
    }
  };

  const handleShutdown = async () => {
    const confirmed = window.confirm("PCをシャットダウンします。続行しますか？");
    if (!confirmed) return;
    await triggerAction("/api/home/shutdown", "shutdown");
  };

  return (
    <PageLayout contentClassName="page-stack">
      <PageIntro title="Home Control" />

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
              {loadingState || state.message ? (
                <div className="info-row info-row--copy">
                  <span className="info-row__copy">
                    {loadingState ? "状態を取得しています..." : state.message}
                  </span>
                </div>
              ) : null}
            </div>

          </section>

          <section className="control-panel">
            <h2 className="solver-section-title">Power Actions</h2>

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

            {actionMessage ? (
              <div className="empty-card" role="status" aria-live="polite">
                {actionMessage}
              </div>
            ) : null}
          </section>
        </div>
      </section>
    </PageLayout>
  );
}

export default HomeControlPage;
