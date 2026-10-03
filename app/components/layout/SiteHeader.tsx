import * as React from "react";
import { Menu, X } from "lucide-react";
import { Link, NavLink, useLocation, useRouteLoaderData } from "~/framework/navigation";
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

function isExternalHref(href: string) {
  return /^https?:\/\//.test(href);
}

export function SiteHeader({
  showLogo = true,
  variant = "default",
}: SiteHeaderProps) {
  const rootData = useRouteLoaderData("root") as { topPageHref?: string } | undefined;
  const location = useLocation();
  const topPageHref = rootData?.topPageHref ?? "/";
  const navItems = siteConfig.primaryNav.filter(isRouteNavItem);
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [mobileMenuClosing, setMobileMenuClosing] = React.useState(false);
  const closeTimerRef = React.useRef<number | null>(null);
  const menuPanelRef = React.useRef<HTMLDivElement>(null);
  const menuToggleRef = React.useRef<HTMLButtonElement>(null);

  const clearCloseTimer = React.useCallback(() => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const closeMobileMenu = React.useCallback(() => {
    clearCloseTimer();
    setMobileMenuOpen(false);
    setMobileMenuClosing(true);
    closeTimerRef.current = window.setTimeout(() => {
      setMobileMenuClosing(false);
      closeTimerRef.current = null;
    }, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 240);
  }, [clearCloseTimer]);

  const openMobileMenu = React.useCallback(() => {
    clearCloseTimer();
    setMobileMenuClosing(false);
    setMobileMenuOpen(true);
  }, [clearCloseTimer]);

  const toggleMobileMenu = React.useCallback(() => {
    if (mobileMenuOpen) {
      closeMobileMenu();
      return;
    }

    openMobileMenu();
  }, [closeMobileMenu, mobileMenuOpen, openMobileMenu]);

  const mobileMenuVisible = mobileMenuOpen || mobileMenuClosing;

  React.useEffect(() => {
    clearCloseTimer();
    setMobileMenuOpen(false);
    setMobileMenuClosing(false);
  }, [location.pathname]);

  React.useEffect(() => {
    document.body.classList.toggle("mobile-menu-active", mobileMenuVisible);
    return () => {
      document.body.classList.remove("mobile-menu-active");
    };
  }, [mobileMenuVisible]);

  React.useEffect(() => {
    if (!mobileMenuOpen) {
      return;
    }
    const panel = menuPanelRef.current;
    const background = Array.from(document.querySelectorAll<HTMLElement>("main, .site-footer, .site-header__frame"));
    const priorInert = background.map(element => element.inert);
    background.forEach(element => { element.inert = true; });
    panel?.querySelector<HTMLButtonElement>(".site-menu-close")?.focus();
    const focusable = () => Array.from(panel?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), [tabindex="0"]') ?? []);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMobileMenu();
      }
      if (event.key === "Tab") {
        const items = focusable();
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault(); last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault(); first?.focus();
        }
      }
    };
    const wideScreen = window.matchMedia("(min-width: 641px)");
    const closeOnResize = () => { if (wideScreen.matches) closeMobileMenu(); };
    wideScreen.addEventListener("change", closeOnResize);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      wideScreen.removeEventListener("change", closeOnResize);
      window.removeEventListener("keydown", handleKeyDown);
      background.forEach((element, index) => { element.inert = priorInert[index]; });
      menuToggleRef.current?.focus();
    };
  }, [closeMobileMenu, mobileMenuOpen]);

  React.useEffect(() => {
    return () => {
      clearCloseTimer();
    };
  }, [clearCloseTimer]);

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
                <Link to={topPageHref} className="site-header__brand-link" prefetch="intent" viewTransition>
                  <SiteBrand compact />
                </Link>
              ) : (
                <Link to={topPageHref} className="site-header__wordmark" prefetch="intent" viewTransition>
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
                const isGroupActive = isRouteActive(location.pathname, item.to) || item.children?.some(child => isRouteActive(location.pathname, child.to)) === true;
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
                      prefetch="intent" viewTransition
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
                          prefetch="intent" viewTransition
                        >
                          {child.label}
                        </NavLink>
                      ))}
                    </div>
                  </div>
                );
              }

              return (
                item.to === "/" && isExternalHref(topPageHref) ? (
                  <a
                    key={item.to}
                    href={topPageHref}
                    className="site-tabs__link"
                  >
                    {item.label}
                  </a>
                ) : (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      cx("site-tabs__link", isActive && "is-active")
                    }
                    prefetch="intent" viewTransition
                  >
                    {item.label}
                  </NavLink>
                )
              );
            })}
          </nav>
        </div>

        <div className="site-header__mobile-bar">
          <div className="site-header__lead">
            {showLogo ? (
              <Link to={topPageHref} className="site-header__brand-link" prefetch="intent" viewTransition>
                <SiteBrand compact />
              </Link>
            ) : (
              <Link to={topPageHref} className="site-header__wordmark" prefetch="intent" viewTransition>
                <span className="site-header__wordmark-name">{siteConfig.name}</span>
              </Link>
            )}
          </div>

          <button
            ref={menuToggleRef}
            type="button"
            className={cx("btn site-menu-toggle", mobileMenuOpen && "is-open")}
            aria-expanded={mobileMenuOpen}
            aria-controls="site-mobile-menu"
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            onClick={toggleMobileMenu}
          >
            {mobileMenuOpen ? (
              <X className="site-menu-icon" size={18} aria-hidden="true" />
            ) : (
              <Menu className="site-menu-icon" size={18} aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      <div
        id="site-mobile-menu"
        inert={!mobileMenuOpen}
        className={cx(
          "site-mobile-menu",
          mobileMenuVisible && "is-visible",
          mobileMenuOpen && "is-open",
          mobileMenuClosing && "is-closing"
        )}
      >
        <button
          type="button"
          className="site-mobile-menu__backdrop"
          aria-label="Close menu"
          onClick={closeMobileMenu}
        />

        <div ref={menuPanelRef} className="site-mobile-menu__panel" role={mobileMenuOpen ? "dialog" : undefined} aria-modal={mobileMenuOpen ? true : undefined} aria-label="サイトメニュー">
          <div className="site-mobile-menu__header">
            <div className="site-header__lead">
              {showLogo ? (
                <Link to={topPageHref} className="site-header__brand-link" prefetch="intent" viewTransition>
                  <SiteBrand compact />
                </Link>
              ) : (
                <Link to={topPageHref} className="site-header__wordmark" prefetch="intent" viewTransition>
                  <span className="site-header__wordmark-name">{siteConfig.name}</span>
                </Link>
              )}
            </div>

            <div className="site-mobile-menu__tools">
              <SiteThemeToggle />
              <button
                type="button"
                className="btn site-menu-close"
                aria-label="Close menu"
                onClick={closeMobileMenu}
              >
                <X className="site-menu-icon" size={18} aria-hidden="true" />
              </button>
            </div>
          </div>

          <nav className="site-mobile-nav" aria-label="Mobile primary">
            {navItems.map((item) => {
              const isGroupActive = isRouteActive(location.pathname, item.to) || item.children?.some(child => isRouteActive(location.pathname, child.to)) === true;

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
                      prefetch="intent" viewTransition
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
                          prefetch="intent" viewTransition
                        >
                          {child.label}
                        </NavLink>
                      ))}
                    </div>
                  </div>
                );
              }

              return (
                item.to === "/" && isExternalHref(topPageHref) ? (
                  <a
                    key={item.to}
                    href={topPageHref}
                    className="site-mobile-nav__link"
                  >
                    {item.label}
                  </a>
                ) : (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      cx("site-mobile-nav__link", isActive && "is-active")
                    }
                    prefetch="intent" viewTransition
                  >
                    {item.label}
                  </NavLink>
                )
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
}
