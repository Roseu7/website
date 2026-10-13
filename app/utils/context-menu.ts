import type { MouseEvent } from "react";

export function handleContextMenu(event: MouseEvent<HTMLElement>) {
  const target = event.target;
  if (!(target instanceof Element)) return;
  if (target.closest("textarea, input:not([type]), input:is([type=text], [type=search], [type=url], [type=tel], [type=email], [type=password], [type=number])") || (target instanceof HTMLElement && target.isContentEditable)) return;

  const document = target.ownerDocument;
  const caret = document.caretPositionFromPoint?.(event.clientX, event.clientY);
  const range = caret ? document.createRange() : document.caretRangeFromPoint?.(event.clientX, event.clientY);
  if (caret && range) { range.setStart(caret.offsetNode, caret.offset); range.collapse(true); }
  const text = range?.startContainer;
  if (range && text?.nodeType === Node.TEXT_NODE && target.contains(text)) {
    let element = text.parentElement;
    let selectable = false;
    while (element) {
      const style = getComputedStyle(element).userSelect;
      if (style !== "auto") { selectable = style !== "none"; break; }
      element = element.parentElement;
    }
    if (selectable) {
      const offset = range.startOffset;
      for (const position of [offset, offset - 1]) {
        if (position < 0 || position >= (text.textContent?.length ?? 0)) continue;
        range.setStart(text, position); range.setEnd(text, position + 1);
        if ([...range.getClientRects()].some(rect => event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom)) return;
      }
    }
  }
  event.preventDefault();
}
