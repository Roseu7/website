export type ServiceBody = Record<string, unknown> & { operation?: unknown };

export function requireStrings(body: ServiceBody, keys: string[]) {
  for (const key of keys) {
    if (typeof body[key] !== "string" || (body[key] as string).length === 0) {
      throw new Response(`Invalid field: ${key}`, { status: 400 });
    }
  }
}
