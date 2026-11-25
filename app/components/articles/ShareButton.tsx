import { useEffect, useRef, useState } from "react";
import { Share2 } from "lucide-react";

// スマホなどOSの共有画面が使える端末ではそれを開き、使えない端末ではURLをコピーする。
export function ShareButton({ title, url }: { title: string; url: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const share = async () => {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, url });
        return;
      } catch (error) {
        // 共有画面を閉じただけなら何もしない。それ以外の失敗はコピーに切り替える。
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt("このURLをコピーしてください", url);
    }
  };
  return (
    <button type="button" className="btn site-button article-share" onClick={() => void share()}>
      <Share2 size={16} aria-hidden />
      <span aria-live="polite">{copied ? "リンクをコピーしました" : "共有"}</span>
    </button>
  );
}
