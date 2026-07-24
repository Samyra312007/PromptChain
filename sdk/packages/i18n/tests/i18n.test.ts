import { describe, it, expect } from "vitest";
import { I18nEngine } from "../src/engine";
import { normalizeNfc, computeCidNfc } from "../src/normalize";
import { graphemeClusterLength, truncateGraphemeClusters, isCjk, isRtlScript, detectDirection } from "../src/graphemes";
import { detectLanguage, resolveLocalizedField } from "../src/resolve";

describe("I18nEngine", () => {
  it("returns English by default", () => {
    const i18n = new I18nEngine({ lang: "en" });
    expect(i18n.t("general.success")).toBe("Success");
  });

  it("returns Chinese translation", () => {
    const i18n = new I18nEngine({ lang: "zh" });
    expect(i18n.t("general.success")).toBe("成功");
  });

  it("falls back to English for missing translations", () => {
    const i18n = new I18nEngine({ lang: "de" });
    expect(i18n.t("general.success")).toBe("Erfolg");
  });

  it("uses fallback language when primary is missing", () => {
    const i18n = new I18nEngine({ lang: "de", fallbackLang: "en" });
    expect(i18n.t("cli.publish.success", { cid: "QmTest" })).toBe("Veröffentlicht! CID: QmTest");
  });

  it("interpolates parameters", () => {
    const i18n = new I18nEngine({ lang: "en" });
    expect(i18n.t("cli.publish.success", { cid: "QmTest123" })).toBe("Published! CID: QmTest123");
  });

  it("caches translations", () => {
    const i18n = new I18nEngine({ lang: "en" });
    const a = i18n.t("general.loading");
    const b = i18n.t("general.loading");
    expect(a).toBe(b);
  });

  it("supports language switching", () => {
    const i18n = new I18nEngine({ lang: "en" });
    expect(i18n.t("general.yes")).toBe("Yes");
    i18n.setLang("zh");
    expect(i18n.t("general.yes")).toBe("是");
  });
});

describe("NFC Normalization", () => {
  it("normalizes to NFC", () => {
    const composed = "é"; // U+00E9
    const decomposed = "e\u0301"; // U+0065 + U+0301
    expect(normalizeNfc(decomposed)).toBe(composed);
  });

  it("produces same CID for composed and decomposed", () => {
    const a = computeCidNfc("café");
    const b = computeCidNfc("cafe\u0301");
    expect(a).toBe(b);
  });

  it("is idempotent", () => {
    const input = "こんにちは世界";
    expect(normalizeNfc(input)).toBe(input);
  });
});

describe("Grapheme Cluster Handling", () => {
  it("counts emoji as single grapheme", () => {
    expect(graphemeClusterLength("👍")).toBe(1);
  });

  it("counts CJK characters correctly", () => {
    expect(graphemeClusterLength("中文測試")).toBe(4);
  });

  it("counts family emoji (ZWJ sequence) as single grapheme", () => {
    const family = "👨‍👩‍👧‍👦";
    expect(graphemeClusterLength(family)).toBe(1);
  });

  it("truncates by grapheme clusters", () => {
    expect(truncateGraphemeClusters("hello world", 5)).toBe("hello");
  });

  it("truncates CJK by grapheme clusters", () => {
    expect(truncateGraphemeClusters("中文測試", 2)).toBe("中文");
  });

  it("detects CJK text", () => {
    expect(isCjk("中文")).toBe(true);
    expect(isCjk("hello")).toBe(false);
    expect(isCjk("日本語")).toBe(true);
    expect(isCjk("한국어")).toBe(true);
  });

  it("detects RTL script", () => {
    expect(isRtlScript("العربية")).toBe(true);
    expect(isRtlScript("hello")).toBe(false);
  });

  it("detects text direction", () => {
    expect(detectDirection("hello")).toBe("ltr");
    expect(detectDirection("العربية")).toBe("rtl");
    expect(detectDirection("hello", "ar")).toBe("rtl");
  });
});

describe("Language Detection", () => {
  it("detects Chinese", () => {
    expect(detectLanguage("你好世界")).toBe("zh");
  });

  it("detects Japanese", () => {
    expect(detectLanguage("こんにちは")).toBe("ja");
  });

  it("detects Korean", () => {
    expect(detectLanguage("안녕하세요")).toBe("ko");
  });

  it("detects Arabic", () => {
    expect(detectLanguage("مرحبا")).toBe("ar");
  });

  it("defaults to English for ASCII", () => {
    expect(detectLanguage("hello world")).toBe("en");
  });
});

describe("Localized Field Resolution", () => {
  it("returns preferred language", () => {
    const field = { en: "Hello", zh: "你好" };
    expect(resolveLocalizedField(field, "Hello", { prefer: "zh" })).toBe("你好");
  });

  it("falls back to English", () => {
    const field = { en: "Hello", zh: "你好" };
    expect(resolveLocalizedField(field, "Hello", { prefer: "es" })).toBe("Hello");
  });

  it("falls back to default text when no localized field", () => {
    expect(resolveLocalizedField(undefined, "Hello", { prefer: "en" })).toBe("Hello");
  });

  it("uses first value when neither preferred nor English available", () => {
    const field = { zh: "你好", es: "Hola" };
    expect(resolveLocalizedField(field, "Hello", { prefer: "fr" })).toBe("你好");
  });
});
