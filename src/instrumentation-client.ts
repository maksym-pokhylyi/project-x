import { publicEnv } from "@/env.public";

/**
 * Browser-side instrumentation (runs once, before the app becomes interactive).
 *
 * Optional PostHog: page views (including client-side navigations) are captured when
 * NEXT_PUBLIC_POSTHOG_KEY is set. The library is loaded lazily, so without a key nothing
 * is downloaded and no request is made. Server-side events go through track().
 */
if (publicEnv.posthogKey) {
  void import("posthog-js").then(({ default: posthog }) => {
    posthog.init(publicEnv.posthogKey, {
      api_host: publicEnv.posthogHost,
      capture_pageview: "history_change",
      capture_pageleave: true,
      person_profiles: "identified_only",
      autocapture: false,
    });
  });
}
