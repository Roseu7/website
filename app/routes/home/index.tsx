import { useEffect, useState } from "react";
import { Link, useActionData, useLoaderData, type ActionFunctionArgs, type LoaderFunctionArgs } from "react-router";
import { PageLayout } from "~/components/layout/PageLayout";
import { HomeControlPage } from "~/components/home/HomeControlPage";
import { McDashboardPage } from "~/routes/mc/dashboard";
import {
  formatMcCheckedAt,
  isMcServerOnline,
  type McDashboardLoaderData,
} from "~/utils/mc/dashboard";
import { isCanonicalHomeControlHost } from "~/utils/home/host";
import {
  isMcDashboardHost,
} from "~/utils/mc/host";
import { siteConfig } from "~/utils/site";

const homeTitleLines = [
  "作ってみたいものを、",
  "ちゃんと動く形で残していく。",
];

const homeTitleText = homeTitleLines.join("");
const siteDescription = "作ってみたいものを、ちゃんと動く形で残していく個人サイト。";
const socialImageUrl = "https://roseu.net/images/digitalsandbox.png?v=20260614";
const socialImageAlt = "Digital Sandbox";
const homeTitleInitialDelayMs = 1000;
const homeTitleDelayMs = 60;
const homeTitleLinePauseMs = 240;

const homeTitleChars = homeTitleLines.flatMap((line) => Array.from(line));
const homeTitleFirstLineLength = Array.from(homeTitleLines[0]).length;

function AnimatedHomeTitle() {
  const [selectedCount, setSelectedCount] = useState(0);

  useEffect(() => {
    let count = 0;
    let timeoutId: number | null = null;

    const tick = () => {
      count += 1;
      setSelectedCount(count);

      if (count >= homeTitleChars.length) return;

      timeoutId = window.setTimeout(
        tick,
        count === homeTitleFirstLineLength ? homeTitleLinePauseMs : homeTitleDelayMs
      );
    };

    timeoutId = window.setTimeout(tick, homeTitleInitialDelayMs);

    return () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, []);

  const renderLine = (text: string, lineSelectedCount: number, isSecond = false) => {
    const chars = Array.from(text);
    const selectedText = chars.slice(0, lineSelectedCount).join("");

    return (
      <span
        className={`home-lead__line${isSecond ? " home-lead__line--second" : ""}`}
        aria-hidden="true"
      >
        <span className="home-lead__line-base">{text}</span>
        {selectedText ? (
          <span className="home-lead__selected-prefix">{selectedText}</span>
        ) : null}
      </span>
    );
  };

  const firstLineSelectedCount = Math.min(selectedCount, homeTitleFirstLineLength);
  const secondLineSelectedCount = Math.max(0, selectedCount - homeTitleFirstLineLength);

  return (
    <>
      {renderLine(homeTitleLines[0], firstLineSelectedCount)}
      {renderLine(homeTitleLines[1], secondLineSelectedCount, true)}
    </>
  );
}

export async function loader({ request, context }: LoaderFunctionArgs) {
  const { hostname } = new URL(request.url);
  const isHomeControlHost = isCanonicalHomeControlHost(hostname);
  const isMcHost = isMcDashboardHost(hostname);

  return {
    isHomeControlHost,
    isMcDashboardHost: isMcHost,
    mcDashboardData: isMcHost ? await loadMcDashboardData(request, context) : null,
  };
}

export const meta = ({ data }: { data?: { isHomeControlHost?: boolean; isMcDashboardHost?: boolean } }) => {
  if (data?.isMcDashboardHost) {
    return [
      { title: `Survival Server | ${siteConfig.fullName}` },
      { name: "description", content: "Minecraft サーバー情報" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "theme-color", content: siteConfig.themeColor },
    ];
  }

  if (data?.isHomeControlHost) {
    return [
      { title: `Home Control | ${siteConfig.fullName}` },
      { name: "description", content: "自宅PCの状態確認と電源操作を行う管理ページ" },
      { name: "robots", content: "noindex, nofollow" },
    ];
  }

  return [
    { title: siteConfig.fullName },
    { name: "description", content: siteDescription },
    { name: "author", content: siteConfig.owner },
    { property: "og:title", content: siteConfig.fullName },
    { property: "og:description", content: siteDescription },
    { property: "og:image", content: socialImageUrl },
    { property: "og:image:type", content: "image/png" },
    { property: "og:image:width", content: "1242" },
    { property: "og:image:height", content: "699" },
    { property: "og:image:alt", content: socialImageAlt },
    { property: "og:url", content: "https://roseu.net" },
    { property: "og:type", content: "website" },
    { property: "og:site_name", content: siteConfig.name },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: siteConfig.fullName },
    { name: "twitter:description", content: siteDescription },
    { name: "twitter:image", content: socialImageUrl },
    { name: "twitter:image:alt", content: socialImageAlt },
    { name: "twitter:creator", content: "@Roseu_7" },
    { name: "twitter:site", content: "@Roseu_7" },
    { name: "theme-color", content: siteConfig.themeColor },
    { name: "msapplication-TileColor", content: siteConfig.themeColor },
  ];
};

async function loadMcDashboardData(
  request: Request,
  context: LoaderFunctionArgs["context"]
): Promise<McDashboardLoaderData> {
  const [{ requireMcDashboardHost }, { getMcSession }, { getMcDashboardEnv, requireOwnerDiscordUser }, { getActiveMinecraftLink, getDiscordUser, getServerState }] =
    await Promise.all([
      import("~/utils/mc/host"),
      import("~/utils/mc/session.server"),
      import("~/utils/mc/env.server"),
      import("~/utils/mc/db.server"),
    ]);

  requireMcDashboardHost(request);

  const session = await getMcSession(request, context);
  const discordUserId = session.get("discordUserId");
  const env = getMcDashboardEnv(context);
  const url = new URL(request.url);
  const serverState = await getServerState(env.DB);
  const serverOnline = serverState
    ? isMcServerOnline(serverState.checkedAt, serverState.online)
    : false;
  const checkedAtLabel = serverState
    ? formatMcCheckedAt(serverState.checkedAt)
    : "-";

  if (!discordUserId) {
    return {
      isAuthenticated: false,
      discordUser: null,
      minecraftLink: null,
      serverState,
      serverOnline,
      checkedAtLabel,
      loginUrl: "/auth/discord/start",
      notice:
        url.searchParams.get("linked") === "1"
          ? "アカウントの紐づけが完了しました。"
          : url.searchParams.get("map") === "offline"
            ? "サーバーがオフラインのため、Server Map は現在利用できません。"
            : null,
    };
  }
  requireOwnerDiscordUser(env, discordUserId);

  const [discordUser, minecraftLink] = await Promise.all([
    getDiscordUser(env.DB, discordUserId),
    getActiveMinecraftLink(env.DB, discordUserId),
  ]);

  return {
    isAuthenticated: Boolean(discordUser),
    discordUser,
    minecraftLink,
    serverState,
    serverOnline,
    checkedAtLabel,
    loginUrl: "/auth/discord/start",
    notice:
      url.searchParams.get("linked") === "1"
        ? "アカウントの紐づけが完了しました。"
        : url.searchParams.get("map") === "offline"
          ? "サーバーがオフラインのため、Server Map は現在利用できません。"
          : null,
  };
}

export async function action({ request, context }: ActionFunctionArgs) {
  const { hostname } = new URL(request.url);
  if (!isMcDashboardHost(hostname)) {
    throw new Response("Not Found", { status: 404 });
  }

  const [{ requireMcMutationOrigin }, { getMcSession }, { getMcDashboardEnv }, { consumeLinkCodeAndLinkDiscord }] =
    await Promise.all([
      import("~/utils/mc/host"),
      import("~/utils/mc/session.server"),
      import("~/utils/mc/env.server"),
      import("~/utils/mc/db.server"),
    ]);

  requireMcMutationOrigin(request);

  const formData = await request.formData();
  const intent = formData.get("intent");
  if (intent !== "link-code") {
    throw new Response("Bad Request", { status: 400 });
  }

  const session = await getMcSession(request, context);
  const discordUserId = session.get("discordUserId");
  if (!discordUserId) {
    return Response.json({ linkError: "先に Discord へログインしてください。" }, { status: 401 });
  }

  const code = formData.get("code");
  if (typeof code !== "string" || code.trim().length === 0) {
    return Response.json({ linkError: "リンクコードを入力してください。" }, { status: 400 });
  }

  const env = getMcDashboardEnv(context);
  const result = await consumeLinkCodeAndLinkDiscord(env.DB, discordUserId, code);
  if (!result.ok) {
    return Response.json({ linkError: result.message }, { status: 400 });
  }

  return Response.redirect("/?linked=1", 302);
}

export default function Home() {
  const actionData = useActionData<typeof action>() as { linkError?: string } | undefined;
  const loaderData = useLoaderData<typeof loader>() as { isHomeControlHost: boolean; isMcDashboardHost?: boolean; mcDashboardData?: McDashboardLoaderData };
  const { isHomeControlHost } = loaderData;

  if (isHomeControlHost) {
    return <HomeControlPage />;
  }

  if (loaderData.isMcDashboardHost && loaderData.mcDashboardData) {
    return <McDashboardPage data={loaderData.mcDashboardData} linkError={actionData?.linkError ?? null} />;
  }

  return (
    <PageLayout
      contentClassName="home-page"
      headerVariant="landing"
      showHeaderLogo={false}
    >
      <section className="home-lead" aria-labelledby="home-title">
        <h1 id="home-title" className="home-lead__title" aria-label={homeTitleText}>
          <AnimatedHomeTitle />
        </h1>
      </section>

      <section className="home-index" aria-label="Navigation">
        <Link to="/projects" className="home-index__link" viewTransition>
          <span className="home-index__label">Projects</span>
          <span className="home-index__copy">過去に作った作品たち。</span>
        </Link>
        <Link to="/about" className="home-index__link" viewTransition>
          <span className="home-index__label">About me</span>
          <span className="home-index__copy">ろせ / Roseu のこと。</span>
        </Link>
        <Link to="/tools" className="home-index__link" viewTransition>
          <span className="home-index__label">Tools</span>
          <span className="home-index__copy">自分の技術を試す小道具たち。</span>
        </Link>
      </section>

      <section className="home-now" aria-labelledby="home-now-title">
        <p className="home-now__label" id="home-now-title">Recently</p>
        <div className="home-now__links">
          <Link to="/tools/wsolver" className="home-now__link" viewTransition>
            Wordle Solver を開く
          </Link>
          <Link to="/projects" className="home-now__link" viewTransition>
            過去の作品を見る
          </Link>
        </div>
      </section>
    </PageLayout>
  );
}
