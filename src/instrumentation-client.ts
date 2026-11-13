/**
 * Browser-side instrumentation (runs once, before the app becomes interactive).
 *
 * Optional PostHog: page views (including client-side navigations) are captured when
 * NEXT_PUBLIC_POSTHOG_KEY is set. The library is loaded lazily, so without a key nothing
 * is downloaded and no request is made. Server-side events go through track().
 */
const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;

if (posthogKey) {
  void import("posthog-js").then(({ default: posthog }) => {
    posthog.init(posthogKey, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
      capture_pageview: "history_change",
      capture_pageleave: true,
      person_profiles: "identified_only",
      autocapture: false,
    });
  });
}

export {};
