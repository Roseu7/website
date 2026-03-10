import { useLoaderData, type LoaderFunctionArgs } from "react-router";
import { InteractiveBrandHero } from "~/components/brand/InteractiveBrandHero";
import { PageLayout } from "~/components/layout/PageLayout";
import { HomeControlPage } from "~/routes/home/control";
import { isCanonicalHomeControlHost } from "~/utils/home-host";
import { siteConfig } from "~/utils/site";

export async function loader({ request }: LoaderFunctionArgs) {
  const { hostname } = new URL(request.url);
  return { isHomeControlHost: isCanonicalHomeControlHost(hostname) };
}

export const meta = () => {
  return [
    { title: siteConfig.fullName },
    { name: "author", content: siteConfig.owner },
    { property: "og:title", content: siteConfig.fullName },
    { property: "og:image", content: "https://roseu.net/images/digitalsandbox.webp" },
    { property: "og:url", content: "https://roseu.net" },
    { property: "og:type", content: "website" },
    { property: "og:site_name", content: siteConfig.name },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: siteConfig.fullName },
    { name: "twitter:image", content: "https://roseu.net/images/digitalsandbox.webp" },
    { name: "twitter:creator", content: "@Roseu_7" },
    { name: "twitter:site", content: "@Roseu_7" },
    { name: "theme-color", content: siteConfig.themeColor },
    { name: "msapplication-TileColor", content: siteConfig.themeColor },
  ];
};

export default function Home() {
  const { isHomeControlHost } = useLoaderData<typeof loader>();

  if (isHomeControlHost) {
    return <HomeControlPage />;
  }

  return (
    <PageLayout
      bleed
      contentClassName="home-page"
      headerVariant="landing"
      showHeaderLogo={false}
      withTopOffset={false}
    >
      <InteractiveBrandHero />
    </PageLayout>
  );
}
