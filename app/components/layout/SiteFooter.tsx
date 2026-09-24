import { Link, useRouteLoaderData } from "react-router";
import { SiteBrand } from "~/components/brand/SiteBrand";
import { getCopyrightText } from "~/utils/site";

export function SiteFooter() {
  const rootData = useRouteLoaderData("root") as { legalBaseHref?: string } | undefined;
  const legalBaseHref = rootData?.legalBaseHref ?? "";

  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <Link to="/" className="site-footer__brand-link" viewTransition>
          <SiteBrand compact />
        </Link>
        <nav className="site-footer__links" aria-label="フッター">
          <Link to={`${legalBaseHref}/privacy`} className="site-footer__link" viewTransition>
            プライバシー
          </Link>
          <Link to={`${legalBaseHref}/terms`} className="site-footer__link" viewTransition>
            利用規約
          </Link>
          <Link to={`${legalBaseHref}/contact`} className="site-footer__link" viewTransition>
            お問い合わせ
          </Link>
          <Link to={`${legalBaseHref}/licenses`} className="site-footer__link" viewTransition>
            Licenses
          </Link>
        </nav>
        <p className="site-footer__copyright">{getCopyrightText()}</p>
      </div>
    </footer>
  );
}
