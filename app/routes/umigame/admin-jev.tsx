import {
  Form,
  Link,
  redirect,
  useLoaderData,
  useNavigation,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "react-router";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Cpu,
  Gauge,
  Layers3,
  RefreshCw,
  Route,
  ShieldCheck,
} from "lucide-react";
import { PageLayout } from "~/components/layout/PageLayout";
import { requireSameOriginRequest } from "~/utils/request-origin.server";
import { MAX_FORM_BODY_BYTES, readLimitedFormData } from "~/utils/request-body.server";
import { UmigameBackLink } from "~/components/umigame/UmigameBackLink";
import {
  getAdminJevAnalytics,
  requireUmigameAdmin,
} from "~/utils/umigame/admin.server";
import { getUmigameEnv } from "~/utils/umigame/env.server";
import {
  getGoldenTestOverview,
  runGoldenTestBatch,
} from "~/utils/umigame/golden-test.server";
import { siteConfig } from "~/utils/site";

export const meta = () => [
  { title: `Jev監視 | ウミガメ管理 | ${siteConfig.fullName}` },
];

export async function loader({ request, context }: LoaderFunctionArgs) {
  await requireUmigameAdmin(request, context);
  const env = getUmigameEnv(context);
  const [analytics, golden] = await Promise.all([
    getAdminJevAnalytics(env),
    getGoldenTestOverview(env),
  ]);
  const url = new URL(request.url);
  return {
    analytics,
    golden,
    goldenNotice:
      url.searchParams.get("golden") === "done"
        ? "Golden Testを実行しました。"
        : null,
  };
}

export async function action({ request, context }: ActionFunctionArgs) {
  requireSameOriginRequest(request);
  await requireUmigameAdmin(request, context);
  const form = await readLimitedFormData(request, MAX_FORM_BODY_BYTES);
  const provider = String(form.get("provider") ?? "");
  if (provider !== "vercel" && provider !== "typesafe") {
    throw new Response("Unknown provider.", { status: 400 });
  }

  await runGoldenTestBatch(getUmigameEnv(context), provider);
  return redirect("/games/umigame/admin/jev?golden=done");
}

function percent(value: number) {
  return new Intl.NumberFormat("ja-JP", {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(value);
}

function number(value: number) {
  return new Intl.NumberFormat("ja-JP").format(value);
}

function cost(value: number | null) {
  if (value === null) return "—";
  return "$" + value.toFixed(value < 0.01 ? 6 : 4);
}

function dateTime(value: number) {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}
export default function UmigameAdminJevPage() {
  const { analytics, golden, goldenNotice } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const goldenRunning =
    navigation.state === "submitting" &&
    navigation.formData?.has("provider");
  const latestGoldenBatchId = golden.batches[0]?.batchId ?? null;
  const latestGoldenRuns = latestGoldenBatchId
    ? golden.latestRuns.filter((run) => run.batchId === latestGoldenBatchId)
    : [];
  const maxDailyCalls = Math.max(
    1,
    ...analytics.daily.map((item) => item.calls),
  );

  return (
    <PageLayout contentClassName="page-stack">
      <div className="umigame-admin-jev-nav">
        <UmigameBackLink fallbackTo="/games/umigame/admin" fallbackLabel="管理画面に戻る" />
      </div>

      <section className="umigame-admin-head">
        <div>
          <h2>Jev監視</h2>
          <p>
            ウミガメで発生したJev実行を、Provider・用途・エラー・token・latencyで確認します。
          </p>
        </div>
        <Activity size={32} aria-hidden="true" />
      </section>

      <section className="umigame-jev-config" aria-label="Current Jev configuration">
        <div>
          <span>Primary</span>
          <strong>{analytics.currentProvider}</strong>
        </div>
        <div>
          <span>Fallback</span>
          <strong>{analytics.fallbackProvider}</strong>
        </div>
        <div>
          <span>Model</span>
          <strong>{analytics.configuredModel}</strong>
        </div>
      </section>

      <section className="umigame-admin-section umigame-golden-tests">
        <div className="umigame-section-head">
          <div>
            <h2>Golden Test</h2>
            <p>
              seed問題のGM質問を再実行し、期待値との一致率やProvider差を確認します。
            </p>
          </div>
          <span className="umigame-count">{golden.caseCount} cases</span>
        </div>

        {goldenNotice ? (
          <p className="umigame-success" role="status">{goldenNotice}</p>
        ) : null}

        <div className="umigame-golden-actions">
          <Form method="post">
            <input type="hidden" name="provider" value="vercel" />
            <button
              type="submit"
              className="btn site-button"
              disabled={!golden.providers.vercel || goldenRunning}
            >
              {goldenRunning ? "実行中…" : "Vercelで実行"}
            </button>
          </Form>
          <Form method="post">
            <input type="hidden" name="provider" value="typesafe" />
            <button
              type="submit"
              className="btn site-button site-button--ghost"
              disabled={!golden.providers.typesafe || goldenRunning}
              title={
                golden.providers.typesafe
                  ? undefined
                  : "TYPESAFE_API_KEYが未設定です"
              }
            >
              TypeSafeで実行
            </button>
          </Form>
          <span>
            Vercel: {golden.providers.vercel ? "利用可" : "未設定"} /
            TypeSafe: {golden.providers.typesafe ? "利用可" : "未設定"}
          </span>
        </div>

        {golden.comparison.averageExpectedProbabilityDifference !== null ? (
          <p className="umigame-golden-comparison">
            最新Vercel / TypeSafeバッチ間の期待回答probability平均差:
            {" "}
            {(golden.comparison.averageExpectedProbabilityDifference * 100).toFixed(1)}
            pt
          </p>
        ) : null}

        {golden.batches.length > 0 ? (
          <div className="umigame-golden-batches">
            <div className="umigame-golden-batch-row is-head">
              <span>time</span>
              <span>provider / model</span>
              <span>一致</span>
              <span>errors</span>
              <span>timeout</span>
              <span>latency</span>
              <span>tokens</span>
            </div>
            {golden.batches.map((batch) => (
              <div key={batch.batchId} className="umigame-golden-batch-row">
                <span>{dateTime(batch.createdAt)}</span>
                <span>
                  <strong>{batch.provider}</strong>
                  <small>{batch.model ?? "unknown"}</small>
                </span>
                <span>
                  {batch.passed}/{batch.total}
                  {" "}
                  ({percent(batch.total ? batch.passed / batch.total : 0)})
                </span>
                <span>{batch.errors}</span>
                <span>
                  {batch.timeouts}/{batch.total}
                  {" "}
                  ({percent(batch.total ? batch.timeouts / batch.total : 0)})
                </span>
                <span>{batch.avgLatency}ms</span>
                <span>{number(batch.inputTokens + batch.outputTokens)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="empty-card">まだGolden Testの実行履歴はありません。</p>
        )}

        {latestGoldenRuns.length > 0 ? (
          <div className="umigame-golden-cases">
            <h3>最新バッチのケース結果</h3>
            {latestGoldenRuns.map((run) => {
              const matched =
                run.status === "ok" &&
                run.actualCode === run.expectedCode;
              return (
                <div key={run.id} className="umigame-golden-case">
                  <div>
                    <Link to={`/games/umigame/p/${run.displayId}`}>
                      #{run.displayId} {run.title}
                    </Link>
                    <p>{run.question}</p>
                  </div>
                  <div className="umigame-golden-case__result">
                    <span className="status-pill">
                      expected {run.expectedCode}
                    </span>
                    <span
                      className={matched ? "status-pill is-ok" : "status-pill is-error"}
                    >
                      {run.status === "error"
                        ? run.errorKind ?? "error"
                        : run.actualCode ?? "—"}
                    </span>
                    {run.expectedProbability !== null ? (
                      <small>
                        expected p={(run.expectedProbability * 100).toFixed(1)}%
                      </small>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </section>

      <section className="umigame-admin-stats" aria-label="Jev today">
        <div>
          <strong>{number(analytics.total)}</strong>
          <span>calls / 今日(JST)</span>
        </div>
        <div>
          <strong>{percent(analytics.successRate)}</strong>
          <span>成功率</span>
        </div>
        <div>
          <strong>{number(analytics.fallbacks)}</strong>
          <span>fallback</span>
        </div>
        <div>
          <strong>{analytics.avgLatency}ms</strong>
          <span>平均latency</span>
        </div>
        <div>
          <strong>{number(analytics.inputTokens)}</strong>
          <span>input tokens</span>
        </div>
        <div>
          <strong>{number(analytics.outputTokens)}</strong>
          <span>output tokens</span>
        </div>
        <div>
          <strong>{number(analytics.errors)}</strong>
          <span>errors</span>
        </div>
        <div>
          <strong>{cost(analytics.estimatedCostUsd)}</strong>
          <span>推定cost</span>
        </div>
      </section>
      <section className="umigame-admin-section">
        <div className="umigame-section-head">
          <div>
            <div className="umigame-icon-label">
              <Route size={20} aria-hidden="true" />
              <h2>Provider別</h2>
            </div>
            <p>今日(JST)の実行内訳。</p>
          </div>
        </div>

        <div className="umigame-jev-provider-grid">
          {analytics.providers.map((provider) => (
            <article key={provider.provider} className="umigame-jev-provider-card">
              <div className="umigame-jev-provider-card__head">
                <strong>{provider.provider}</strong>
                <span>{number(provider.calls)} calls</span>
              </div>
              <dl>
                <div><dt>成功率</dt><dd>{percent(provider.calls ? (provider.calls - provider.errors) / provider.calls : 1)}</dd></div>
                <div><dt>平均latency</dt><dd>{provider.avgLatency}ms</dd></div>
                <div><dt>fallback</dt><dd>{number(provider.fallbacks)}</dd></div>
                <div><dt>input</dt><dd>{number(provider.inputTokens)}</dd></div>
                <div><dt>output</dt><dd>{number(provider.outputTokens)}</dd></div>
                <div><dt>推定cost</dt><dd>{cost(provider.estimatedCostUsd)}</dd></div>
              </dl>
            </article>
          ))}
        </div>
      </section>

      <section className="umigame-admin-section">
        <div className="umigame-section-head">
          <div>
            <div className="umigame-icon-label">
              <Layers3 size={20} aria-hidden="true" />
              <h2>用途別</h2>
            </div>
            <p>どの機能がJevを使っているかを確認します。</p>
          </div>
        </div>

        <div className="umigame-jev-purpose-table">
          <div className="umigame-jev-purpose-row is-head">
            <span>purpose</span>
            <span>calls</span>
            <span>errors</span>
            <span>latency</span>
            <span>input</span>
          </div>
          {analytics.purposes.map((purpose) => (
            <div key={purpose.purpose} className="umigame-jev-purpose-row">
              <strong>{purpose.purpose}</strong>
              <span>{number(purpose.calls)}</span>
              <span>{number(purpose.errors)}</span>
              <span>{purpose.avgLatency}ms</span>
              <span>{number(purpose.inputTokens)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="umigame-admin-section">
        <div className="umigame-section-head">
          <div>
            <div className="umigame-icon-label">
              <AlertTriangle size={20} aria-hidden="true" />
              <h2>エラー内訳</h2>
            </div>
            <p>Primary Providerの失敗理由を分類します。</p>
          </div>
        </div>

        <div className="umigame-admin-stats">
          <div><strong>{analytics.errorBreakdown.rateLimited}</strong><span>429</span></div>
          <div><strong>{analytics.errorBreakdown.serverErrors}</strong><span>5xx</span></div>
          <div><strong>{analytics.errorBreakdown.timeouts}</strong><span>timeout</span></div>
          <div><strong>{analytics.errorBreakdown.networkErrors}</strong><span>network</span></div>
        </div>
      </section>
      <section className="umigame-admin-section">
        <div className="umigame-section-head">
          <div>
            <div className="umigame-icon-label">
              <Gauge size={20} aria-hidden="true" />
              <h2>7日間のcalls</h2>
            </div>
            <p>JSTの日付単位。バーは日ごとのcalls相対値です。</p>
          </div>
        </div>

        <div className="umigame-jev-daily">
          {analytics.daily.map((day) => (
            <div key={day.day} className="umigame-jev-daily__row">
              <span>{day.day.slice(5)}</span>
              <div className="umigame-jev-daily__bar">
                <span
                  style={{
                    width: `${Math.max(3, (day.calls / maxDailyCalls) * 100)}%`,
                  }}
                />
              </div>
              <strong>{day.calls}</strong>
              <small>{day.errors} err / {number(day.input_tokens)} in</small>
            </div>
          ))}
        </div>
      </section>

      <section className="umigame-admin-section">
        <div className="umigame-section-head">
          <div>
            <div className="umigame-icon-label">
              <Cpu size={20} aria-hidden="true" />
              <h2>モデル</h2>
            </div>
            <p>今日(JST)に実際のレスポンスへ記録されたモデル。</p>
          </div>
        </div>
        <div className="umigame-jev-model-list">
          {analytics.models.map((model) => (
            <div key={model.model}>
              <code>{model.model}</code>
              <span>{number(model.calls)} calls</span>
            </div>
          ))}
        </div>
      </section>

      <section className="umigame-admin-section">
        <div className="umigame-section-head">
          <div>
            <div className="umigame-icon-label">
              <RefreshCw size={20} aria-hidden="true" />
              <h2>直近のJev実行</h2>
            </div>
            <p>最新50件。state本文やcanonical truthは表示・保存しません。</p>
          </div>
        </div>

        <div className="umigame-jev-run-table">
          <div className="umigame-jev-run-row is-head">
            <span>time</span>
            <span>purpose</span>
            <span>provider</span>
            <span>status</span>
            <span>latency</span>
            <span>tokens</span>
          </div>
          {analytics.latestRuns.map((run, index) => (
            <div
              key={`${run.created_at}-${index}`}
              className="umigame-jev-run-row"
            >
              <span>{dateTime(run.created_at)}</span>
              <strong>{run.purpose}</strong>
              <span>
                {run.provider}
                {run.fallback_used ? " / fallback" : ""}
              </span>
              <span className="status-pill">{run.status}</span>
              <span>{run.latency_ms}ms</span>
              <span>{number((run.input_tokens ?? 0) + (run.output_tokens ?? 0))}</span>
              {run.primary_error ? (
                <code className="umigame-jev-run-row__error">
                  {run.primary_error}
                </code>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <section className="umigame-admin-section umigame-jev-pricing-note">
        <div className="umigame-about-section__title">
          <ShieldCheck size={20} aria-hidden="true" />
          <h2>推定costについて</h2>
        </div>
        <p>
          表示額はWranglerに設定したProvider別input単価と記録済みtoken数から算出した概算です。
          プロモーション、無料枠、請求調整は反映しないため、実請求額はProvider側のUsageを正とします。
        </p>
      </section>
    </PageLayout>
  );
}
