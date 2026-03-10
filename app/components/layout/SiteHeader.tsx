import { Link, NavLink, useLocation } from "react-router";
import { SiteBrand } from "~/components/brand/SiteBrand";
import { SiteThemeToggle } from "~/components/layout/SiteThemeToggle";
import { isRouteActive, isRouteNavItem, siteConfig } from "~/utils/site";

interface SiteHeaderProps {
  showLogo?: boolean;
  variant?: SiteHeaderVariant;
}

export type SiteHeaderVariant = "default" | "landing";

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function SiteHeader({
  showLogo = true,
  variant = "default",
}: SiteHeaderProps) {
  const location = useLocation();
  const navItems = siteConfig.primaryNav.filter(isRouteNavItem);

  return (
    <header
      id="main-header"
      className={cx(
        "site-header",
        `site-header--${variant}`,
        !showLogo && "site-header--logo-hidden"
      )}
    >
      <div className="site-header__frame">
        <div className="site-header__topline">
          <div className="site-header__lead">
            {showLogo ? (
              <Link to="/" className="site-header__brand-link" viewTransition>
                <SiteBrand compact />
              </Link>
            ) : (
              <Link to="/" className="site-header__wordmark" viewTransition>
                <span className="site-header__wordmark-name">{siteConfig.name}</span>
              </Link>
            )}
          </div>

          <div className="site-header__tools">
            <SiteThemeToggle />
          </div>
        </div>

        <nav className="site-tabs" aria-label="Primary">
          {navItems.map((item) => {
            const activeChild = item.children?.find((child) =>
              isRouteActive(location.pathname, child.to)
            );

            if (item.children?.length) {
              const isGroupActive = isRouteActive(location.pathname, item.to);
              const groupLabel = activeChild
                ? `${item.label} > ${activeChild.label}`
                : item.label;

              return (
                <div
                  key={item.to}
                  className={cx("site-nav-group", isGroupActive && "is-current")}
                >
                  <NavLink
                    to={item.to}
                    className={({ isActive }) =>
                      cx(
                        "site-tabs__link",
                        "site-tabs__link--group",
                        (isActive || isGroupActive) && "is-active"
                      )
                    }
                    viewTransition
                  >
                    <span>{groupLabel}</span>
                  </NavLink>

                  <div className="site-nav-group__menu" aria-label={`${item.label} menu`}>
                    {item.children.map((child) => (
                      <NavLink
                        key={child.to}
                        to={child.to}
                        className={({ isActive }) =>
                          cx("site-nav-group__link", isActive && "is-active")
                        }
                        viewTransition
                      >
                        {child.label}
                      </NavLink>
                    ))}
                  </div>
                </div>
              );
            }

            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cx("site-tabs__link", isActive && "is-active")
                }
                viewTransition
              >
                {item.label}
              </NavLink>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
