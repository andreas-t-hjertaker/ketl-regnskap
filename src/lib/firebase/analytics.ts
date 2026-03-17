"use client";

import { getAnalytics, logEvent, isSupported } from "firebase/analytics";
import { app } from "./config";

let analyticsInstance: ReturnType<typeof getAnalytics> | null = null;

export async function getAnalyticsInstance() {
  if (analyticsInstance) return analyticsInstance;
  if (typeof window === "undefined") return null;

  const supported = await isSupported();
  if (!supported) return null;

  analyticsInstance = getAnalytics(app);
  return analyticsInstance;
}

export async function trackEvent(
  eventName: string,
  params?: Record<string, string | number | boolean>
) {
  const analytics = await getAnalyticsInstance();
  if (analytics) {
    logEvent(analytics, eventName, params);
  }
}

export async function trackPageView(pagePath: string, pageTitle?: string) {
  const analytics = await getAnalyticsInstance();
  if (analytics) {
    logEvent(analytics, "page_view", {
      page_path: pagePath,
      page_title: pageTitle ?? pagePath,
    });
  }
}
