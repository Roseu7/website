import { useEffect } from "react";

import { useLoaderData } from "~/framework/navigation";

import { PageLayout } from "~/components/layout/PageLayout";

export default function AccessLogoutPage() {
  const { teamDomain } = useLoaderData<typeof loader>();

  useEffect(() => {
    let redirected = false;
    const finish = () => {
      if (redirected) return;
      redirected = true;
      window.location.replace("/games/umigame");
    };

    const fallback = window.setTimeout(finish, 2500);

    void (async () => {
      await Promise.allSettled([
        fetch("/cdn-cgi/access/logout", {
          credentials: "include",
          cache: "no-store",
        }),
        teamDomain
          ? fetch(`https://${teamDomain}/cdn-cgi/access/logout`, {
              credentials: "include",
              cache: "no-store",
              mode: "no-cors",
            })
          : Promise.resolve(),
      ]);
      window.clearTimeout(fallback);
      finish();
    })();

    return () => window.clearTimeout(fallback);
  }, [teamDomain]);

  return (
    <PageLayout contentClassName="umigame-logout-stage">
      <div className="umigame-modal-backdrop umigame-modal-backdrop--status">
        <section
          className="umigame-modal umigame-modal--status"
          role="status"
          aria-live="polite"
        >
          <span className="umigame-kicker">ACCOUNT</span>
          <h1>ログアウト中</h1>
          <p>セッションを終了しています。</p>
          <div className="umigame-status-line" aria-hidden="true" />
        </section>
      </div>
    </PageLayout>
  );
}
import type { loader } from './logout.server';
