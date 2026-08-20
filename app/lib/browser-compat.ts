export function isEmbeddedSocialBrowser(userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent) {
  return /Instagram|FBAN|FBAV|FB_IAB|LinkedInApp|LinkedIn|Twitter|Line\/|Snapchat|TikTok|; wv\)|\bwv\b/i.test(userAgent);
}

export function safeStorageGet(key: string) {
  try { return window.localStorage.getItem(key); } catch { return null; }
}

export function safeStorageSet(key: string, value: string) {
  try { window.localStorage.setItem(key, value); return true; } catch { return false; }
}

export function safeStorageRemove(key: string) {
  try { window.localStorage.removeItem(key); return true; } catch { return false; }
}

export function observeElementResize(element: Element, callback: () => void) {
  let observer: ResizeObserver | null = null;
  const onResize = () => window.requestAnimationFrame(callback);
  if (typeof ResizeObserver !== "undefined") {
    observer = new ResizeObserver(onResize);
    observer.observe(element);
  } else {
    window.addEventListener("resize", onResize, { passive: true });
  }
  window.visualViewport?.addEventListener("resize", onResize, { passive: true });
  return () => {
    observer?.disconnect();
    window.removeEventListener("resize", onResize);
    window.visualViewport?.removeEventListener("resize", onResize);
  };
}
