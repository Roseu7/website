import { parse, serialize, type SerializeOptions } from "cookie";
export type { AppLoadContext } from "./http";

export interface Session<Data, Flash = Data> {
  readonly id: string;
  readonly data: Data;
  get<K extends keyof Data>(name: K): Data[K] | undefined;
  set<K extends keyof Data>(name: K, value: Data[K]): void;
  unset(name: keyof Data): void;
  has(name: keyof Data): boolean;
  flash<K extends keyof Flash>(name: K, value: Flash[K]): void;
}

// Keep the deployed cookie wire format: UTF-8 JSON/base64 + HMAC-SHA256/base64.
// Verification uses Web Crypto rather than comparing signature strings.
export function createCookieSessionStorage<Data extends object>({ cookie }: {
  cookie: SerializeOptions & { name: string; secrets: string[] };
}) {
  const { name, secrets, ...options } = cookie;
  if (!secrets.length) throw new Error("A session signing secret is required.");
  const encoder = new TextEncoder();
  const key = (secret: string, usage: KeyUsage[]) => crypto.subtle.importKey(
    "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, usage,
  );
  const bytes = (text: string) => Uint8Array.from(atob(text), c => c.charCodeAt(0));
  const base64 = (value: Uint8Array) => btoa(String.fromCharCode(...value));
  const session = (initial: Record<string, unknown>): Session<Data> => {
    const values = new Map(Object.entries(initial));
    return {
      id: "", get data() { return Object.fromEntries(values) as Data; },
      get(name) {
        if (values.has(String(name))) return values.get(String(name)) as Data[typeof name];
        const flashName = `__flash_${String(name)}__`;
        const value = values.get(flashName); values.delete(flashName);
        return value as Data[typeof name];
      },
      set: (name, value) => { values.set(String(name), value); },
      unset: name => { values.delete(String(name)); },
      has: name => values.has(String(name)) || values.has(`__flash_${String(name)}__`),
      flash: (name, value) => { values.set(`__flash_${String(name)}__`, value); },
    };
  };
  return {
    async getSession(header: string | null) {
      const signed = header ? parse(header)[name] : undefined;
      if (signed) {
        const dot = signed.lastIndexOf(".");
        if (dot > 0) {
          const payload = signed.slice(0, dot);
          for (const secret of secrets) {
            try {
              if (await crypto.subtle.verify("HMAC", await key(secret, ["verify"]), bytes(signed.slice(dot + 1)), encoder.encode(payload))) {
                const value: unknown = JSON.parse(new TextDecoder().decode(bytes(payload)));
                if (value && typeof value === "object" && !Array.isArray(value)) return session(value as Record<string, unknown>);
              }
            } catch { /* Malformed or invalid cookies become an anonymous session. */ }
          }
        }
      }
      return session({});
    },
    async commitSession(value: Session<Data>) {
      const payload = base64(encoder.encode(JSON.stringify(value.data)));
      const signature = base64(new Uint8Array(await crypto.subtle.sign("HMAC", await key(secrets[0], ["sign"]), encoder.encode(payload)))).replace(/=+$/, "");
      const encoded = serialize(name, `${payload}.${signature}`, options);
      if (encoded.length > 4096) throw new Error("Session cookie exceeds the browser size limit.");
      return encoded;
    },
    async destroySession(_value: Session<Data>) {
      return serialize(name, "", { ...options, maxAge: undefined, expires: new Date(0) });
    },
  };
}
