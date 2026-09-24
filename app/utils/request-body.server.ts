export const MAX_FORM_BODY_BYTES = 64 * 1024;

async function readLimitedBytes(request: Request, maxBytes: number): Promise<Uint8Array> {
  const contentLength = request.headers.get("Content-Length");
  if (contentLength && /^\d+$/.test(contentLength) && Number(contentLength) > maxBytes) {
    throw new Response("Request body is too large.", { status: 413 });
  }

  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();

  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new Response("Request body is too large.", { status: 413 });
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export async function readLimitedText(request: Request, maxBytes: number): Promise<string> {
  return new TextDecoder().decode(await readLimitedBytes(request, maxBytes));
}

export async function readLimitedJson(request: Request, maxBytes: number): Promise<unknown> {
  return JSON.parse(await readLimitedText(request, maxBytes));
}

export async function readLimitedJsonObject(
  request: Request,
  maxBytes: number,
): Promise<Record<string, unknown>> {
  const value = await readLimitedJson(request, maxBytes);
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Response("JSON body must be an object.", { status: 400 });
  }
  return value as Record<string, unknown>;
}

export async function readLimitedFormData(request: Request, maxBytes: number): Promise<FormData> {
  const bytes = await readLimitedBytes(request, maxBytes);
  const body = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(body).set(bytes);
  const headers = new Headers();
  const contentType = request.headers.get("Content-Type");
  if (contentType) headers.set("Content-Type", contentType);
  return new Response(body, { headers }).formData();
}
