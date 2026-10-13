import { StopScreen } from "~/components/os/SystemError";

import { siteConfig } from "~/utils/site";

export const meta = () => {
  return [
    { property: "og:title", content: `404 Not Found | ${siteConfig.fullName}` },
    { property: "og:type", content: "website" },
  ];
};

export function NotFoundPage() {
  return <StopScreen />;
}

export default function NotFound() {
  return <NotFoundPage />;
}

export function ErrorBoundary() {
  return <NotFoundPage />;
}
