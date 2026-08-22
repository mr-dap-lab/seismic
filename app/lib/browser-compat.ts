export function isEmbeddedSocialBrowser(userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent) {
  return /Instagram|FBAN|FBAV|FB_IAB|LinkedInApp|LinkedIn|Twitter|Line\/|Snapchat|TikTok|; wv\)|\bwv\b/i.test(userAgent);
}

function isAndroid(userAgent: string) {
  return /Android/i.test(userAgent);
}

function isIOS(userAgent: string) {
  return /iPhone|iPad|iPod/i.test(userAgent) || (/Macintosh/i.test(userAgent) && /Mobile/i.test(userAgent));
}

/**
 * Returns a user-initiated URL that asks a social WebView to hand the page to
 * a full browser. A normal target=_blank link is intentionally not used here:
 * Instagram captures those links and opens another in-app browser page.
 */
export function externalBrowserLaunchUrl(targetUrl: string, userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent) {
  if (!isEmbeddedSocialBrowser(userAgent)) return targetUrl;

  const target = new URL(targetUrl);
  if (isAndroid(userAgent)) {
    const scheme = target.protocol.replace(":", "");
    const browserTarget = `${target.host}${target.pathname}${target.search}${target.hash}`;
    return `intent://${browserTarget}#Intent;scheme=${scheme};action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;S.browser_fallback_url=${encodeURIComponent(target.href)};end`;
  }

  if (isIOS(userAgent) && target.protocol === "https:") {
    // Instagram on iOS keeps ordinary HTTPS links in its WKWebView. This
    // handoff opens the HTTPS destination in the full Safari application.
    return `x-safari-${target.href}`;
  }

  return target.href;
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
