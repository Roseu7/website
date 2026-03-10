import * as React from "react";
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
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  React.useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  React.useEffect(() => {
    document.body.classList.toggle("mobile-menu-active", mobileMenuOpen);
    return () => {
      document.body.classList.remove("mobile-menu-active");
    };
  }, [mobileMenuOpen]);

  React.useEffect(() => {
    if (!mobileMenuOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileMenuOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileMenuOpen]);

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
        <div className="site-header__desktop">
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

        <div className="site-header__mobile-bar">
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

          <button
            type="button"
            className={cx("site-menu-toggle", mobileMenuOpen && "is-open")}
            aria-expanded={mobileMenuOpen}
            aria-controls="site-mobile-menu"
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMobileMenuOpen((open) => !open)}
          >
            <span className="site-menu-toggle__line" />
            <span className="site-menu-toggle__line" />
            <span className="site-menu-toggle__line" />
          </button>
        </div>
      </div>

      <div
        id="site-mobile-menu"
        className={cx("site-mobile-menu", mobileMenuOpen && "is-open")}
      >
        <button
          type="button"
          className="site-mobile-menu__backdrop"
          aria-label="Close menu"
          onClick={() => setMobileMenuOpen(false)}
        />

        <div className="site-mobile-menu__panel">
          <div className="site-mobile-menu__header">
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

            <div className="site-mobile-menu__tools">
              <SiteThemeToggle />
              <button
                type="button"
                className="site-menu-close"
                aria-label="Close menu"
                onClick={() => setMobileMenuOpen(false)}
              >
                <span className="site-menu-close__line" />
                <span className="site-menu-close__line" />
              </button>
            </div>
          </div>

          <nav className="site-mobile-nav" aria-label="Mobile primary">
            {navItems.map((item) => {
              const isGroupActive = isRouteActive(location.pathname, item.to);

              if (item.children?.length) {
                return (
                  <div
                    key={item.to}
                    className={cx("site-mobile-nav__group", isGroupActive && "is-current")}
                  >
                    <NavLink
                      to={item.to}
                      className={({ isActive }) =>
                        cx("site-mobile-nav__link", (isActive || isGroupActive) && "is-active")
                      }
                      viewTransition
                    >
                      {item.label}
                    </NavLink>

                    <div className="site-mobile-nav__children">
                      {item.children.map((child) => (
                        <NavLink
                          key={child.to}
                          to={child.to}
                          className={({ isActive }) =>
                            cx("site-mobile-nav__link", "site-mobile-nav__link--child", isActive && "is-active")
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
                    cx("site-mobile-nav__link", isActive && "is-active")
                  }
                  viewTransition
                >
                  {item.label}
                </NavLink>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
}
