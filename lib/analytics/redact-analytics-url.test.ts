import { describe, expect, it } from "vitest";

import type { BeforeSendEvent } from "@vercel/analytics/next";

import {
  REDACTED_QUERY_PARAM,
  redactAnalyticsUrl,
} from "@/lib/analytics/redact-analytics-url";

function pageview(url: string): BeforeSendEvent {
  return { type: "pageview", url };
}

function customEvent(url: string): BeforeSendEvent {
  return { type: "event", url };
}

describe("redactAnalyticsUrl", () => {
  it("removes the q search parameter from a page-view URL", () => {
    const result = redactAnalyticsUrl(
      pageview("https://favalog.app/explore?q=blade+runner"),
    );
    expect(result).not.toBeNull();
    const url = new URL(result!.url);
    expect(url.searchParams.has(REDACTED_QUERY_PARAM)).toBe(false);
    expect(url.pathname).toBe("/explore");
  });

  it("removes the q search parameter from a custom-event URL", () => {
    const result = redactAnalyticsUrl(
      customEvent("https://favalog.app/explore?q=dune&kind=movie"),
    );
    expect(result).not.toBeNull();
    const url = new URL(result!.url);
    expect(url.searchParams.has("q")).toBe(false);
    // The event type is preserved.
    expect(result!.type).toBe("event");
  });

  it("preserves other safe search parameters", () => {
    const result = redactAnalyticsUrl(
      pageview("https://favalog.app/explore?kind=book&q=secret&page=2"),
    );
    expect(result).not.toBeNull();
    const url = new URL(result!.url);
    expect(url.searchParams.get("kind")).toBe("book");
    expect(url.searchParams.get("page")).toBe("2");
    expect(url.searchParams.has("q")).toBe(false);
  });

  it("preserves the origin, path, and hash", () => {
    const result = redactAnalyticsUrl(
      pageview("https://favalog.app/explore?q=hidden#results"),
    );
    expect(result).not.toBeNull();
    const url = new URL(result!.url);
    expect(url.origin).toBe("https://favalog.app");
    expect(url.pathname).toBe("/explore");
    expect(url.hash).toBe("#results");
  });

  it("leaves a URL without a q parameter unchanged in substance", () => {
    const result = redactAnalyticsUrl(
      pageview("https://favalog.app/diary?kind=movie"),
    );
    expect(result).not.toBeNull();
    const url = new URL(result!.url);
    expect(url.pathname).toBe("/diary");
    expect(url.searchParams.get("kind")).toBe("movie");
  });

  it("removes every repeated q parameter", () => {
    const result = redactAnalyticsUrl(
      pageview("https://favalog.app/explore?q=one&q=two&kind=tv"),
    );
    expect(result).not.toBeNull();
    const url = new URL(result!.url);
    expect(url.searchParams.getAll("q")).toEqual([]);
    expect(url.searchParams.get("kind")).toBe("tv");
  });

  it("fails closed by dropping the event when the URL is malformed", () => {
    expect(redactAnalyticsUrl(pageview("not a url"))).toBeNull();
    expect(redactAnalyticsUrl(customEvent("://missing-scheme?q=x"))).toBeNull();
    expect(redactAnalyticsUrl(pageview(""))).toBeNull();
  });
});
