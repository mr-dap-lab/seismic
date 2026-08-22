import assert from "node:assert/strict";
import test from "node:test";

import { externalBrowserLaunchUrl } from "../app/lib/browser-compat.ts";

const target = "https://www.sismica.pro/";

test("hands Instagram on Android to the system browser", () => {
  const userAgent = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Mobile Safari/537.36 Instagram 322.0.0";
  const launchUrl = externalBrowserLaunchUrl(target, userAgent);

  assert.match(launchUrl, /^intent:\/\/www\.sismica\.pro\/#Intent;/);
  assert.match(launchUrl, /scheme=https;/);
  assert.match(launchUrl, /action=android\.intent\.action\.VIEW;/);
  assert.match(launchUrl, /category=android\.intent\.category\.BROWSABLE;/);
  assert.match(launchUrl, /S\.browser_fallback_url=https%3A%2F%2Fwww\.sismica\.pro%2F;/);
  assert.doesNotMatch(launchUrl, /package=com\.android\.chrome/);
});

test("hands Instagram on iOS to full Safari", () => {
  const userAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Instagram 322.0.0";

  assert.equal(externalBrowserLaunchUrl(target, userAgent), "x-safari-https://www.sismica.pro/");
});

test("keeps an ordinary browser on the standard HTTPS destination", () => {
  const userAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) Version/17.4 Mobile Safari/604.1";

  assert.equal(externalBrowserLaunchUrl(target, userAgent), target);
});
