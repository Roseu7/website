type AssetPrefix = "webgame" | "rg" | "default";

type AssetRoute = {
  prefix: AssetPrefix;
  bucket: R2Bucket;
  key: string;
};

interface AssetsEnv {
  ASSETS_BUCKET: R2Bucket;
  WEBGAME_BUCKET: R2Bucket;
  RG_BUCKET: R2Bucket;
}

const CACHE_CONTROL_BY_EXTENSION: Record<string, string> = {
  ".css": "public, max-age=31536000, immutable",
  ".js": "public, max-age=31536000, immutable",
  ".png": "public, max-age=31536000, immutable",
  ".jpg": "public, max-age=31536000, immutable",
  ".jpeg": "public, max-age=31536000, immutable",
  ".webp": "public, max-age=31536000, immutable",
  ".svg": "public, max-age=31536000, immutable",
  ".wasm": "public, max-age=31536000, immutable",
  ".json": "public, max-age=60, must-revalidate",
  ".html": "public, max-age=60, must-revalidate",
};

const CONTENT_TYPE_BY_EXTENSION: Record<string, string> = {
  ".cmd": "text/plain; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".png": "image/png",
  ".ps1": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".wasm": "application/wasm",
  ".webp": "image/webp",
};

function normalizeKey(pathname: string): string | null {
  const decoded = decodeURIComponent(pathname);
  const normalized = decoded.replace(/^\/+/, "");

  if (!normalized || normalized.includes("\\") || normalized.includes("\0")) {
    return null;
  }

  for (const segment of normalized.split("/")) {
    if (!segment || segment === "." || segment === "..") {
      return null;
    }
  }

  return normalized;
}

function getExtension(key: string): string {
  const dotIndex = key.lastIndexOf(".");
  return dotIndex === -1 ? "" : key.slice(dotIndex).toLowerCase();
}

function getAssetRoute(url: URL, env: AssetsEnv): AssetRoute | null {
  const key = normalizeKey(url.pathname);
  if (!key) {
    return null;
  }

  if (key.startsWith("webgame/")) {
    return {
      prefix: "webgame",
      bucket: env.WEBGAME_BUCKET,
      key: key.slice("webgame/".length),
    };
  }

  if (key.startsWith("rg/")) {
    return {
      prefix: "rg",
      bucket: env.RG_BUCKET,
      key: key.slice("rg/".length),
    };
  }

  return {
    prefix: "default",
    bucket: env.ASSETS_BUCKET,
    key,
  };
}

async function serveObject(request: Request, route: AssetRoute): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed", {
      status: 405,
      headers: {
        Allow: "GET, HEAD",
      },
    });
  }

  if (!route.key) {
    return new Response("Not found", { status: 404 });
  }

  const object = await route.bucket.get(route.key, {
    onlyIf: request.headers,
  });

  if (!object) {
    return new Response("Not found", { status: 404 });
  }

  if (!("body" in object)) {
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("ETag", object.httpEtag);
    return new Response(null, { status: 304, headers });
  }

  const body = request.method === "HEAD" ? null : (object as R2ObjectBody).body;
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("ETag", object.httpEtag);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Access-Control-Allow-Origin", "*");

  const extension = getExtension(route.key);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", CONTENT_TYPE_BY_EXTENSION[extension] ?? "application/octet-stream");
  }

  if (!headers.has("Cache-Control")) {
    headers.set("Cache-Control", CACHE_CONTROL_BY_EXTENSION[extension] ?? "public, max-age=3600");
  }

  return new Response(body, {
    status: 200,
    headers,
  });
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    const route = getAssetRoute(url, env);

    if (!route) {
      return new Response("Not found", { status: 404 });
    }

    return serveObject(request, route);
  },
} satisfies ExportedHandler<AssetsEnv>;
