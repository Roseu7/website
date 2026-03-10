import * as React from "react";
import { SiteFooter } from "~/components/layout/SiteFooter";
import {
  SiteHeader,
  type SiteHeaderVariant,
} from "~/components/layout/SiteHeader";

interface PageLayoutProps {
  children: React.ReactNode;
  bleed?: boolean;
  contentClassName?: string;
  headerVariant?: SiteHeaderVariant;
  mainClassName?: string;
  showHeaderLogo?: boolean;
  withTopOffset?: boolean;
}

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function PageLayout({
  children,
  bleed = false,
  contentClassName,
  headerVariant = "default",
  mainClassName,
  showHeaderLogo = true,
  withTopOffset = true,
}: PageLayoutProps) {
  return (
    <div className="page-frame">
      <SiteHeader variant={headerVariant} showLogo={showHeaderLogo} />
      <main
        className={cx(
          "page-layout",
          bleed && "page-layout--bleed",
          withTopOffset && "page-layout--offset",
          mainClassName
        )}
      >
        <div className={cx("page-layout__viewport", bleed && "page-layout__viewport--bleed")}>
          <div className={cx("page-layout__inner", contentClassName)}>{children}</div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
