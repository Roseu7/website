import { useEffect, useRef, useState } from "react";
import { Share2, X } from "lucide-react";

// 共有ボタン。押すと小さなウィンドウを開き、URLのコピーとXへの投稿を選べるようにする。
// OSの共有画面が使える端末（スマホなど）では、ほかのアプリへ送るボタンも出す。
export function ShareButton({ title, url }: { title: string; url: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    setCanShare(typeof navigator.share === "function");
    return () => clearTimeout(timer.current);
  }, []);

  const open = () => { setCopied(false); dialog.current?.showModal(); };
  const close = () => dialog.current?.close();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("このURLをコピーしてください", url);
    }
  };
  const shareElsewhere = async () => {
    try {
      await navigator.share({ title, url });
      close();
    } catch {
      // 共有画面を閉じただけのときも含め、このウィンドウはそのまま残す。
    }
  };
  const postUrl = `https://x.com/intent/post?${new URLSearchParams({ text: title, url })}`;

  return (
    <>
      <button type="button" className="btn site-button article-share" onClick={open}>
        <Share2 size={16} aria-hidden />共有
      </button>
      <dialog
        ref={dialog}
        className="article-share-dialog"
        aria-labelledby="article-share-title"
        {...{ closedby: "any" }}
        // closedby に対応していないブラウザでも、外側（背景）を押したら閉じる。
        onClick={event => { if (event.target === event.currentTarget) close(); }}
      >
        <div className="article-share-dialog__titlebar">
          <h2 id="article-share-title">共有</h2>
          <button type="button" className="article-share-dialog__close" aria-label="閉じる" title="閉じる" onClick={close}><X size={16} aria-hidden /></button>
        </div>
        <div className="article-share-dialog__body">
          {/* URLの欄そのものを押すとコピーする。コピーしたら、少しのあいだURLの代わりにその旨を出す。 */}
          <button type="button" className="article-share-dialog__url" title="押すとURLをコピーします" aria-label={`URLをコピー：${url}`} data-copied={copied || undefined} onClick={() => void copy()} autoFocus>
            <span className="article-share-dialog__url-text">{copied ? "コピーしました" : url}</span>
          </button>
          <p className="sr-only" role="status">{copied ? "URLをコピーしました" : ""}</p>
          <div className="article-share-dialog__actions">
            <a className="btn site-button" href={postUrl} target="_blank" rel="noopener noreferrer" onClick={close}>Xで共有</a>
            {canShare && <button type="button" className="btn site-button" onClick={() => void shareElsewhere()}>ほかのアプリで共有</button>}
          </div>
        </div>
      </dialog>
    </>
  );
}
