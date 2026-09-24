const COOKIE_NAME = "umigame_anon_id";
const MAX_AGE = 60 * 60 * 24 * 365;

function readCookie(request: Request, name: string) {
  const header = request.headers.get("Cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (rawName === name) {
      try {
        return decodeURIComponent(rawValue.join("="));
      } catch {
        return null;
      }
    }
  }
  return null;
}

function isValidActorId(value: string | null): value is string {
  return Boolean(value && /^[0-9a-f-]{36}$/i.test(value));
}

export function getAnonymousActorId(request: Request) {
  const value = readCookie(request, COOKIE_NAME);
  return isValidActorId(value) ? value : null;
}

export function ensureAnonymousActor(request: Request) {
  const existing = getAnonymousActorId(request);
  if (existing) return { actorId: existing, setCookie: null as string | null };

  return createAnonymousActor(request);
}

export function createAnonymousActor(request: Request) {
  const actorId = crypto.randomUUID();
  const secure = new URL(request.url).protocol === "https:";
  const parts = [
    COOKIE_NAME + "=" + encodeURIComponent(actorId),
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=" + MAX_AGE,
  ];
  if (secure) parts.push("Secure");
  return { actorId, setCookie: parts.join("; ") };
}

export function clearAnonymousActorCookie(request: Request) {
  const secure = new URL(request.url).protocol === "https:";
  const parts = [
    COOKIE_NAME + "=",
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function requireAnonymousActor(request: Request) {
  const actorId = getAnonymousActorId(request);
  if (!actorId) {
    throw Response.json(
      { error: { code: "SESSION_COOKIE_MISSING", message: "プレイセッションが見つかりません。" } },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }
  return actorId;
}
