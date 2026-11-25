import { MAIN_SITE_HOSTS } from "../app/utils/host-config";

function isMapRequest(request: Request): boolean {
  const url = new URL(request.url);
  return url.hostname === "mc.roseu.net" && (url.pathname === "/map" || url.pathname.startsWith("/map/"));
}

export function withSecurityHeaders(request: Request, response: Response, nonce: string): Response {
  const nextHeaders = new Headers(response.headers);
  // BlueMap's translation compiler uses new Function. Keep this exception
  // only on successfully proxied map documents, never on auth/error pages.
  const isMapDocument = isMapRequest(request)
    && response.status === 200
    && nextHeaders.get("X-Map-Proxy-Origin-Status") === "200"
    && /^text\/html(?:;|$)/i.test(nextHeaders.get("Content-Type") ?? "");
  const pathname = new URL(request.url).pathname;
  const isContactRoute = pathname === "/contact";
  // 記事のYouTube埋め込みを許可する。CSPは最初に読み込んだ文書で決まり、R OSは読み込み直さずに
  // ページを移るので、記事のページだけに付けると、ほかのページから開いた記事で遮断される。
  // そのためメインのサイトの文書すべてに付ける（管理画面の編集画面もこのホストにある）。
  const allowsArticleEmbeds = MAIN_SITE_HOSTS.has(new URL(request.url).hostname);
  const scriptSrc = `script-src 'self' 'nonce-${nonce}'${isMapDocument ? " 'unsafe-eval'" : ""}`;
  const turnstileSource = isContactRoute ? " https://challenges.cloudflare.com" : "";
  const youtubeSource = allowsArticleEmbeds ? " https://www.youtube-nocookie.com" : "";
  const csp = [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    `${scriptSrc}${turnstileSource}`,
    `frame-src 'self'${turnstileSource}${youtubeSource}`,
    "worker-src 'self' blob:",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self'",
    `connect-src 'self'${turnstileSource} https://roseu.net https://www.roseu.net https://roseu.cloudflareaccess.com ws: wss:`,
    "form-action 'self'",
    "upgrade-insecure-requests",
  ].join("; ");

  nextHeaders.set("X-Content-Type-Options", "nosniff");
  nextHeaders.set("Referrer-Policy", "strict-origin-when-cross-origin");
  nextHeaders.set("X-Frame-Options", "DENY");
  nextHeaders.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  nextHeaders.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  nextHeaders.set("Content-Security-Policy", csp);
  if (nextHeaders.get("Content-Type")?.includes("text/html")) {
    nextHeaders.set("Cache-Control", "no-store");
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: nextHeaders,
  });
}
