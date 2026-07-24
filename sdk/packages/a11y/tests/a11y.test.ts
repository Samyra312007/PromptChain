import { describe, it, expect } from "vitest";
import { LowBandwidthMode } from "../src/low-bandwidth";
import { ScreenReaderHelper } from "../src/screen-reader";
import { ColorContrast } from "../src/color-contrast";
import { AccessibleOutput } from "../src/accessible-output";
import { KeyboardShortcuts } from "../src/keyboard";
import { OfflineAccess } from "../src/offline";
import { accessibleLabel, stripAnsi, truncateUtf8, byteSize } from "../src/utils";

describe("LowBandwidthMode", () => {
  it("allows all payloads when disabled", () => {
    const lb = new LowBandwidthMode({ enabled: false });
    expect(lb.checkPayloadSize(1_000_000)).toBe(true);
  });

  it("blocks oversized payloads when enabled", () => {
    const lb = new LowBandwidthMode({ enabled: true });
    expect(lb.checkPayloadSize(1_000_000)).toBe(false);
    expect(lb.checkPayloadSize(1_000)).toBe(true);
  });

  it("checks response size", () => {
    const lb = new LowBandwidthMode({ enabled: true });
    expect(lb.checkResponseSize(200_000)).toBe(false);
    expect(lb.checkResponseSize(50_000)).toBe(true);
  });

  it("blocks images by default", () => {
    const lb = new LowBandwidthMode({ enabled: true });
    expect(lb.shouldBlockImage()).toBe(true);
  });

  it("blocks preload and prefetch by default", () => {
    const lb = new LowBandwidthMode({ enabled: true });
    expect(lb.shouldBlockPreload()).toBe(true);
    expect(lb.shouldBlockPrefetch()).toBe(true);
  });

  it("limits concurrent requests", () => {
    const lb = new LowBandwidthMode({ enabled: true });
    expect(lb.getConcurrencyLimit()).toBe(2);
    lb.setEnabled(false);
    expect(lb.getConcurrencyLimit()).toBe(Infinity);
  });

  it("wraps payloads", () => {
    const lb = new LowBandwidthMode({ enabled: true, budget: { maxPayloadBytes: 10 } });
    expect(lb.wrap("hello")).toBe("hello");
    expect(lb.wrap("this is too long")).toBeNull();
  });
});

describe("ScreenReaderHelper", () => {
  it("formats status labels", () => {
    const sr = new ScreenReaderHelper();
    const label = sr.formatStatus("publish", "success");
    expect(label.label).toContain("completed");
    expect(label.live).toBe("polite");
  });

  it("announces error assertively", () => {
    const sr = new ScreenReaderHelper();
    const label = sr.formatStatus("publish", "error");
    expect(label.live).toBe("assertive");
  });

  it("formats empty list", () => {
    const sr = new ScreenReaderHelper();
    expect(sr.formatList([], () => "")).toBe("No items.");
  });

  it("formats numbered list", () => {
    const sr = new ScreenReaderHelper();
    const items = ["alpha", "beta"];
    expect(sr.formatList(items, (item) => item)).toBe("1. alpha\n2. beta");
  });

  it("formats metrics", () => {
    const sr = new ScreenReaderHelper();
    expect(sr.formatMetrics({ totalPrompts: 42, cacheHitRatio: 0.95 }))
      .toContain("total prompts: 42");
  });

  it("stores announcements", () => {
    const sr = new ScreenReaderHelper();
    sr.announce({ level: "info", message: "test" });
    expect(sr.getAnnouncements()).toHaveLength(1);
  });
});

describe("ColorContrast", () => {
  it("detects ANSI support from environment", () => {
    expect(ColorContrast.detectAnsiSupport()).toBe(false);
  });

  it("defaults to normal contrast", () => {
    const cc = new ColorContrast();
    expect(cc.contrast).toBe("normal");
  });

  it("detects high contrast", () => {
    const cc = new ColorContrast({ scheme: "high-contrast-dark" });
    expect(cc.isHighContrast()).toBe(true);
  });

  it("formats high-contrast labels", () => {
    const cc = new ColorContrast({ contrast: "high" });
    expect(cc.getLabel("error")).toBe("[ERROR]");
  });

  it("normal label for normal contrast", () => {
    const cc = new ColorContrast({ contrast: "normal" });
    expect(cc.getLabel("error")).toBe("error");
  });
});

describe("AccessibleOutput", () => {
  it("renders text format", () => {
    const ao = new AccessibleOutput("text");
    const result = ao.render({
      format: "text",
      title: "Test Results",
      entries: [{ key: "status", label: "Status", value: "ok", severity: "success" }],
    });
    expect(result).toContain("Test Results");
    expect(result).toContain("Status: ok");
  });

  it("renders JSON format", () => {
    const ao = new AccessibleOutput("json");
    const result = ao.render({
      format: "json",
      title: "Test",
      entries: [{ key: "status", label: "Status", value: "ok" }],
    });
    const parsed = JSON.parse(result);
    expect(parsed.title).toBe("Test");
    expect(parsed.entries[0].value).toBe("ok");
  });

  it("renders screen-reader format", () => {
    const ao = new AccessibleOutput("screen-reader");
    const result = ao.render({
      format: "screen-reader",
      title: "Deploy Summary",
      entries: [
        { key: "a", label: "Prompts", value: "12", severity: "success" },
      ],
    });
    expect(result).toContain("[SUCCESS]");
    expect(result).toContain("Prompts: 12");
  });

  it("renders quiet format with only critical entries", () => {
    const ao = new AccessibleOutput("quiet");
    const result = ao.render({
      format: "quiet",
      title: "Test",
      entries: [
        { key: "s", label: "Status", value: "ok", severity: "success" },
        { key: "e", label: "Error", value: "timeout", severity: "error" },
      ],
    });
    expect(result).not.toContain("Status");
    expect(result).toContain("ERROR");
  });
});

describe("KeyboardShortcuts", () => {
  it("registers and retrieves shortcuts", () => {
    const ks = new KeyboardShortcuts();
    ks.register({
      id: "publish",
      label: "Publish prompt",
      combo: { key: "p", ctrl: true },
      handler: () => {},
      category: "prompts",
    });
    expect(ks.get("publish")).toBeDefined();
    expect(ks.get("publish")?.label).toBe("Publish prompt");
  });

  it("formats shortcut combos", () => {
    const ks = new KeyboardShortcuts();
    expect(ks.formatShortcut({ key: "p", ctrl: true })).toBe("Ctrl+P");
    expect(ks.formatShortcut({ key: "f", ctrl: true, shift: true })).toBe("Ctrl+Shift+F");
  });

  it("groups by category", () => {
    const ks = new KeyboardShortcuts();
    ks.registerMany([
      { id: "a", label: "A", combo: { key: "a" }, handler: () => {}, category: "cat1" },
      { id: "b", label: "B", combo: { key: "b" }, handler: () => {}, category: "cat2" },
    ]);
    expect(ks.getByCategory("cat1")).toHaveLength(1);
  });

  it("generates help text", () => {
    const ks = new KeyboardShortcuts();
    ks.register({
      id: "q",
      label: "Quit",
      combo: { key: "q", ctrl: true },
      handler: () => {},
      category: "general",
    });
    expect(ks.formatHelp()).toContain("Ctrl+Q");
  });
});

describe("OfflineAccess", () => {
  it("enqueues items", () => {
    const oa = new OfflineAccess();
    const id = oa.enqueue({ type: "publish", payload: "test", maxRetries: 3 });
    expect(id).toBeTruthy();
    expect(oa.getPendingCount()).toBe(1);
  });

  it("returns empty string when disabled", () => {
    const oa = new OfflineAccess({ enabled: false });
    expect(oa.enqueue({ type: "publish", payload: "test", maxRetries: 3 })).toBe("");
  });

  it("syncs items successfully", async () => {
    const oa = new OfflineAccess();
    oa.enqueue({ type: "publish", payload: "test1", maxRetries: 3 });
    oa.enqueue({ type: "publish", payload: "test2", maxRetries: 3 });
    const result = await oa.sync(async () => true);
    expect(result.synced).toBe(2);
    expect(result.failed).toBe(0);
    expect(oa.hasPending()).toBe(false);
  });

  it("retries failed items", async () => {
    const oa = new OfflineAccess();
    oa.enqueue({ type: "publish", payload: "test", maxRetries: 3 });
    await oa.sync(async () => { throw new Error("fail"); });
    expect(oa.getPendingCount()).toBe(1);
    expect(oa.getQueue()[0].retries).toBe(1);
  });

  it("discards items after max retries", async () => {
    const oa = new OfflineAccess({ maxRetries: 1 });
    oa.enqueue({ type: "publish", payload: "test", maxRetries: 1 });
    await oa.sync(async () => { throw new Error("fail"); });
    const result = await oa.sync(async () => { throw new Error("fail"); });
    expect(result.failed).toBe(1);
    expect(oa.hasPending()).toBe(false);
  });

  it("clears the queue", () => {
    const oa = new OfflineAccess();
    oa.enqueue({ type: "publish", payload: "test", maxRetries: 3 });
    oa.clear();
    expect(oa.hasPending()).toBe(false);
  });
});

describe("Utils", () => {
  it("builds accessible labels", () => {
    expect(accessibleLabel("Publish", "prompt", null, undefined)).toBe("Publish prompt");
  });

  it("strips ANSI codes", () => {
    expect(stripAnsi("\u001b[31mred\u001b[0m")).toBe("red");
  });

  it("truncates UTF-8 safely", () => {
    expect(truncateUtf8("hello world", 5)).toBe("hello");
    const cjk = "中文測試";
    const truncated = truncateUtf8(cjk, 6);
    expect(Buffer.byteLength(truncated, 'utf8')).toBeLessThanOrEqual(6);
  });

  it("measures byte size", () => {
    expect(byteSize("hello")).toBe(5);
    expect(byteSize(null)).toBe(0);
    expect(byteSize(Buffer.from("abc"))).toBe(3);
  });
});
