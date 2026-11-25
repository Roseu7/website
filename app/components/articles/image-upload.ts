const MAX_EDGE = 2000;
const MAX_BYTES = 2 * 1024 * 1024;

export interface UploadedImage { url: string; width: number; height: number }

async function encode(bitmap: ImageBitmap, width: number, height: number) {
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("画像を変換できませんでした。");
  context.drawImage(bitmap, 0, 0, width, height);
  // iOSのSafariはWebPを書き出せずPNGを返すので、そのときはJPEGにする。
  const webp = await canvas.convertToBlob({ type: "image/webp", quality: 0.85 });
  if (webp.type === "image/webp") return webp;
  return canvas.convertToBlob({ type: "image/jpeg", quality: 0.85 });
}

export async function uploadArticleImage(file: File): Promise<UploadedImage> {
  if (!file.type.startsWith("image/")) throw new Error("画像のファイルを選んでください。");
  const bitmap = await createImageBitmap(file).catch(() => { throw new Error("この画像は読み込めませんでした。"); });
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  let blob: Blob;
  try {
    blob = await encode(bitmap, width, height);
  } finally {
    bitmap.close();
  }
  if (blob.size > MAX_BYTES) throw new Error("変換後の画像が2MBを超えました。");

  const response = await fetch("/admin/api/images", { method: "POST", headers: { "Content-Type": blob.type }, body: blob });
  const result = await response.json().catch(() => null) as { url?: string; error?: { message?: string } } | null;
  if (!response.ok || !result?.url) throw new Error(result?.error?.message ?? "画像をアップロードできませんでした。");
  return { url: result.url, width, height };
}
