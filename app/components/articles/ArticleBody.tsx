import { useEffect, useRef } from "react";

// 続けて押したときに、前のタイマーで「コピーしました」が早く消えないよう、ツールチップごとに覚える。
const tipTimers = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();

// 本文のHTMLは renderArticleHtml（app/utils/articles/render.ts）が作る。
// ここでは差し込むだけにして、読者のブラウザにエディタ一式を配らないようにする。
// shareUrl を渡すと、節へのリンクはそのURLを元に作る（管理画面のプレビューでは公開URLを渡す）。
export function ArticleBody({ html, shareUrl }: { html: string; shareUrl?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    // 見出しの「#」ボタンで、その節へのリンクをコピーする。
    const onClick = async (event: MouseEvent) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-anchor]");
      if (!button || !root.contains(button)) return;
      place(event);
      const url = new URL(shareUrl ?? window.location.href);
      url.hash = button.dataset.anchor ?? "";
      const tip = document.getElementById(button.getAttribute("aria-describedby") ?? "");
      try {
        await navigator.clipboard.writeText(url.toString());
        if (tip) {
          tip.textContent = "コピーしました";
          tip.dataset.show = "";
          clearTimeout(tipTimers.get(tip));
          tipTimers.set(tip, setTimeout(() => {
            tip.textContent = "この節へのリンクをコピー";
            delete tip.dataset.show;
          }, 1500));
        }
      } catch {
        // クリップボードが使えないときは、今のページでその節へ移る。
        window.location.hash = url.hash;
      }
    };
    // ツールチップを出す前に、本文の右端に収まるかを測って、伸ばす向きを決める。
    const place = (event: Event) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-anchor]");
      const tip = button && document.getElementById(button.getAttribute("aria-describedby") ?? "");
      if (!button || !tip) return;
      // 隠れている間は幅が0なので、見えない状態で一瞬表示して幅を測る。
      tip.style.visibility = "hidden";
      tip.style.display = "block";
      const width = tip.offsetWidth;
      tip.style.removeProperty("display");
      tip.style.removeProperty("visibility");
      const limit = Math.min(root.getBoundingClientRect().right, document.documentElement.clientWidth);
      tip.dataset.align = button.getBoundingClientRect().left + width > limit ? "end" : "start";
    };
    root.addEventListener("click", onClick);
    root.addEventListener("pointerover", place);
    root.addEventListener("focusin", place);
    return () => {
      root.removeEventListener("click", onClick);
      root.removeEventListener("pointerover", place);
      root.removeEventListener("focusin", place);
    };
  }, [shareUrl]);
  return <div ref={ref} className="article-body" dangerouslySetInnerHTML={{ __html: html }} />;
}
