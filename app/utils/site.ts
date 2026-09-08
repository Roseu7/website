export interface RouteNavItem {
  label: string;
  to: string;
  children?: RouteNavItem[];
}

export interface AnchorNavItem {
  label: string;
  href: string;
}

export type SiteNavItem = RouteNavItem | AnchorNavItem;

export function isRouteNavItem(item: SiteNavItem): item is RouteNavItem {
  return "to" in item;
}

export function isRouteActive(pathname: string, to: string) {
  return to === "/"
    ? pathname === "/"
    : pathname === to || pathname.startsWith(`${to}/`);
}

export const siteConfig = {
  name: "Digital Sandbox",
  fullName: "Digital Sandbox",
  owner: "Roseu",
  themeColor: "#1868db",
  copyright: {
    year: "2026",
    holder: "Roseu",
  },
  social: {
    x: "https://x.com/Roseu_7",
    github: "https://github.com/Roseu7",
  },
  primaryNav: [
    { label: "Home", to: "/" },
    { label: "Projects", to: "/projects" },
    { label: "About me", to: "/about" },
    {
      label: "Tools",
      to: "/tools",
      children: [{ label: "Wordle Solver", to: "/tools/wsolver" }],
    },
  ] satisfies SiteNavItem[],
} as const;

export function getCopyrightText() {
  return `\u00a9 ${siteConfig.copyright.year} ${siteConfig.copyright.holder}. All Rights Reserved.`;
}
