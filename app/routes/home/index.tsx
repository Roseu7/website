import { useEffect, useState } from "react";

import { Link, useActionData, useLoaderData } from "~/framework/navigation";

import { PageLayout } from "~/components/layout/PageLayout";

import { HomeControlPage } from "~/components/home/HomeControlPage";

import { McDashboardPage } from "~/routes/mc/dashboard";

import type { McDashboardLoaderData } from "~/utils/mc/dashboard";

import { isMcDashboardHost } from "~/utils/host-config";

import { siteConfig } from "~/utils/site";

const homeTitleLines = [
  "作ってみたいものを、",
  "動く形で残していく",
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
        <Link to="/projects" className="home-index__link" prefetch="viewport" viewTransition>
          <span className="home-index__label">Projects</span>
          <span className="home-index__copy">過去に作った作品</span>
        </Link>
        <Link to="/about" className="home-index__link" prefetch="viewport" viewTransition>
          <span className="home-index__label">About me</span>
          <span className="home-index__copy">ろせ/Roseuについて</span>
        </Link>
        <Link to="/lab" className="home-index__link" prefetch="viewport" viewTransition>
          <span className="home-index__label">Lab</span>
          <span className="home-index__copy"><span>遊べるゲーム</span> / <span>使えるかもしれないツール</span></span>
        </Link>
      </section>

      <section className="home-now" aria-labelledby="home-now-title">
        <p className="home-now__label" id="home-now-title">Recently</p>
        <div className="home-now__links">
          <Link to="/games/umigame" className="home-now__link" prefetch="intent" viewTransition>
            ウミガメのスープを遊ぶ
          </Link>
          <Link to="/tools/wsolver" className="home-now__link" prefetch="intent" viewTransition>
            Wordle Solverを開く
          </Link>
          <Link to="/projects" className="home-now__link" prefetch="intent" viewTransition>
            過去の作品を見る
          </Link>
        </div>
      </section>
    </PageLayout>
  );
}
import type { loader, action } from './index.server';
