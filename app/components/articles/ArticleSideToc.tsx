import { useEffect, useRef, useState } from "react";

interface OutlineItem { id: string; level: 2 | 3; text: string }

// 見出しのうち、表示領域の上から READING_LINE までに入った最後のものを「今読んでいる節」とみなす。
const READING_LINE = 96;

function scrollerOf(element: Element): HTMLElement | Window {
  let node = element.parentElement;
  while (node) {
    const overflow = getComputedStyle(node).overflowY;
    if ((overflow === "auto" || overflow === "scroll") && node.scrollHeight > node.clientHeight) return node;
    node = node.parentElement;
  }
  return window;
}

// 広い画面で本文の右に出す目次。読んでいる位置に合わせて、今の節を強調する。
export function ArticleSideToc({ outline }: { outline: OutlineItem[] }) {
  const ref = useRef<HTMLElement>(null);
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    const nav = ref.current;
    if (!nav) return;
    const headings = outline.map(item => document.getElementById(item.id)).filter((element): element is HTMLElement => element !== null);
    if (!headings.length) return;
    // R OSではウィンドウの中身がスクロールするので、見出しを含むスクロール領域を探して見張る。
    const scroller = scrollerOf(headings[0]);
    let frame = 0;
    const update = () => {
      frame = 0;
      const top = scroller instanceof Window ? 0 : scroller.getBoundingClientRect().top;
      let current: string | null = null;
      for (const heading of headings) {
        if (heading.getBoundingClientRect().top - top <= READING_LINE) current = heading.id;
        else break;
      }
      // 最後の節が短いと、その見出しが上まで来る前にスクロールが止まるので、一番下では最後の節にする。
      const element = scroller instanceof Window ? document.documentElement : scroller;
      if (element.scrollTop + element.clientHeight >= element.scrollHeight - 2) current = headings[headings.length - 1].id;
      setActive(current ?? headings[0].id);
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    scroller.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      scroller.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [outline]);
  return (
    <nav ref={ref} className="article-side-toc" aria-label="目次">
      <p className="article-side-toc__title">目次</p>
      <ol>
        {outline.map(item => (
          <li key={item.id} data-level={item.level}>
            <a href={`#${item.id}`} aria-current={active === item.id ? "location" : undefined}>{item.text || "（無題の節）"}</a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
