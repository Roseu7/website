// R OSではウィンドウの中身がスクロールするので、要素を含むスクロール領域を探す。
// 今は中身が短くても、画像を読み込んで伸びることがあるので、はみ出しているかどうかでは選ばない。
// body の overflow は画面全体に移るので、body まで来たら画面全体とみなす。
export function scrollerOf(element: Element): HTMLElement | Window {
  let node = element.parentElement;
  while (node && node !== document.body) {
    const overflow = getComputedStyle(node).overflowY;
    if (overflow === "auto" || overflow === "scroll") return node;
    node = node.parentElement;
  }
  return window;
}
