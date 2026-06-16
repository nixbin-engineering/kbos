export function findScrollParent(el: HTMLElement | null): HTMLElement | null {
  let node = el?.parentElement ?? null;
  while (node && node !== document.body) {
    const { overflowY } = getComputedStyle(node);
    if (/(auto|scroll|overlay)/.test(overflowY) && node.scrollHeight > node.clientHeight) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

/** Scroll container so `el` is fully visible; flips menu upward when needed. */
export function ensureElementVisible(el: HTMLElement, preferFlip = false): boolean {
  const scrollParent = findScrollParent(el);
  const elRect = el.getBoundingClientRect();
  const containerRect = scrollParent
    ? scrollParent.getBoundingClientRect()
    : { top: 0, bottom: window.innerHeight, left: 0, right: window.innerWidth };

  let flip = false;
  const overflowBottom = elRect.bottom - containerRect.bottom;
  const overflowTop = containerRect.top - elRect.top;

  if (overflowBottom > 0) {
    if (preferFlip && overflowBottom > elRect.height * 0.5 && elRect.top - containerRect.top > elRect.height) {
      flip = true;
    } else if (scrollParent) {
      scrollParent.scrollTop += overflowBottom + 8;
    }
  } else if (overflowTop > 0 && scrollParent) {
    scrollParent.scrollTop -= overflowTop + 8;
  }

  return flip;
}
