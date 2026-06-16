/** Copy text during a user gesture (click). Uses execCommand for broad browser / HTTP support. */
export function copyToClipboard(text: string): boolean {
  if (!text) return false;

  const el = document.createElement("textarea");
  el.value = text;
  el.setAttribute("readonly", "");
  el.style.position = "fixed";
  el.style.top = "0";
  el.style.left = "0";
  el.style.width = "1px";
  el.style.height = "1px";
  el.style.opacity = "0";
  el.style.pointerEvents = "none";
  document.body.appendChild(el);
  el.focus();
  el.select();
  el.setSelectionRange(0, text.length);

  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }

  document.body.removeChild(el);
  return ok;
}
