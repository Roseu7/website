import { Link } from "react-router";
import { SiteBrand } from "~/components/brand/SiteBrand";
import { getCopyrightText } from "~/utils/site";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <Link to="/" className="site-footer__brand-link" viewTransition>
          <SiteBrand compact />
        </Link>
        <p className="site-footer__copyright">{getCopyrightText()}</p>
      </div>
    </footer>
  );
}
