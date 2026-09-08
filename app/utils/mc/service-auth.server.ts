function toBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function toHex(bytes: Uint8Array) {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

async function sha256HmacBase64(secret: string, payload: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return toBase64(new Uint8Array(signature));
}

export async function deriveServerApiSecret(masterSecret: string, serverId: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(masterSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`smanage-api:${serverId}`)
  );
  return toHex(new Uint8Array(signature).slice(0, 16));
}

function timingSafeEqual(left: string, right: string) {
  if (left.length !== right.length) {
    return false;
  }

  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return diff === 0;
}

export async function verifySignedServiceBody(
  request: Request,
  bodyText: string,
  secret: string,
  maxSkewMs = 5 * 60 * 1000
) {
  const timestamp = request.headers.get("X-Timestamp");
  const nonce = request.headers.get("X-Nonce");
  const signature = request.headers.get("X-Signature");

  if (!timestamp || !nonce || !signature) {
    throw new Response("Missing signature headers.", { status: 401 });
  }

  const parsedTimestamp = new Date(timestamp).getTime();
  if (!Number.isFinite(parsedTimestamp) || Math.abs(Date.now() - parsedTimestamp) > maxSkewMs) {
    throw new Response("Signature timestamp is invalid.", { status: 401 });
  }

  const url = new URL(request.url);
  const payload = [timestamp, nonce, request.method.toUpperCase(), url.pathname, bodyText].join("\n");
  const expectedSignature = await sha256HmacBase64(secret, payload);

  if (!timingSafeEqual(signature, expectedSignature)) {
    throw new Response("Signature verification failed.", { status: 401 });
  }

}

export function parseServiceJson<T>(bodyText: string) {
  let json: T;
  try {
    json = JSON.parse(bodyText) as T;
  } catch {
    throw new Response("Request body must be valid JSON.", { status: 400 });
  }
  return json;
}

export async function verifySignedServiceJson<T>(request: Request, secret: string) {
  const bodyText = await request.text();
  await verifySignedServiceBody(request, bodyText, secret);
  return parseServiceJson<T>(bodyText);
}
