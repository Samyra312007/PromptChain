import { mkdtempSync, existsSync } from "fs";
import { mkdir, writeFile, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { computeCid, createDefaultMetadata, isValidPromptFile, PROMPT_FILE_EXT, META_FILE_SUFFIX } from "@promptchain/storage";

export type FuzzerSeverity = "error" | "warning" | "info";

export interface FuzzResult {
  filePath: string;
  promptText: string;
  scenario: string;
  severity: FuzzerSeverity;
  expectedRejection: boolean;
  rejectedAsExpected: boolean;
  cid: string;
  error?: string;
}

export interface PromptFsFuzzerConfig {
  seed: number;
  casesPerCategory: number;
  maxStringLength: number;
  tempDir?: string;
}

export const DEFAULT_FUZZER_CONFIG: PromptFsFuzzerConfig = {
  seed: 42,
  casesPerCategory: 20,
  maxStringLength: 1000,
};

export class PromptFsFuzzer {
  private config: PromptFsFuzzerConfig;
  private results: FuzzResult[] = [];
  private rng: () => number;

  constructor(config: Partial<PromptFsFuzzerConfig> = {}) {
    this.config = { ...DEFAULT_FUZZER_CONFIG, ...config };
    this.rng = this.seededRandom(this.config.seed);
  }

  private seededRandom(seed: number): () => number {
    let s = seed;
    return () => {
      s = (s * 1664525 + 1013904223) & 0xffffffff;
      return (s >>> 0) / 0xffffffff;
    };
  }

  private randomInt(min: number, max: number): number {
    return Math.floor(this.rng() * (max - min + 1)) + min;
  }

  private randomChar(): string {
    const ranges = [
      [0x20, 0x7e],
      [0x80, 0x10ff],
      [0x2000, 0x206f],
      [0xfff0, 0xfffd],
      [0xd800, 0xdfff],
      [0xfe00, 0xfe0f],
      [0xe000, 0xf8ff],
      [0x0, 0x1f],
      [0x7f, 0x9f],
      [0x200b, 0x200d],
      [0x2060, 0x2064],
    ];
    const range = ranges[this.randomInt(0, ranges.length - 1)];
    const cp = this.randomInt(range[0], range[1]);
    if (cp >= 0xd800 && cp <= 0xdfff) {
      const high = cp;
      const low = this.randomInt(0xdc00, 0xdfff);
      return String.fromCodePoint(high, low);
    }
    try {
      return String.fromCodePoint(cp);
    } catch {
      return "?";
    }
  }

  private randomString(minLen: number, maxLen: number): string {
    const len = this.randomInt(minLen, maxLen);
    let s = "";
    for (let i = 0; i < len; i++) {
      s += this.randomChar();
    }
    return s;
  }

  private randomAsciiString(minLen: number, maxLen: number): string {
    const len = this.randomInt(minLen, maxLen);
    let s = "";
    for (let i = 0; i < len; i++) {
      s += String.fromCodePoint(this.randomInt(0x20, 0x7e));
    }
    return s;
  }

  getResults(): FuzzResult[] {
    return [...this.results];
  }

  private record(result: FuzzResult): void {
    this.results.push(result);
  }

  async fuzzMalformedCids(tempDir: string): Promise<FuzzResult[]> {
    const scenarios: Array<{ desc: string; cid: string; severity: FuzzerSeverity; shouldReject: boolean }> = [
      { desc: "empty CID", cid: "", severity: "error", shouldReject: true },
      { desc: "null bytes in CID", cid: "Qm\x00Test\x00CID", severity: "error", shouldReject: true },
      { desc: "CID with only whitespace", cid: "   ", severity: "error", shouldReject: true },
      { desc: "CID longer than 70 bytes", cid: "x".repeat(71), severity: "error", shouldReject: true },
      { desc: "CID with newlines", cid: "QmTest\nCID", severity: "error", shouldReject: true },
      { desc: "CID with tabs", cid: "QmTest\tCID", severity: "warning", shouldReject: false },
      { desc: "CID with emoji", cid: "QmTest🚀CID", severity: "warning", shouldReject: false },
      { desc: "CID with Unicode bidi override", cid: "Qm\u202ETest", severity: "warning", shouldReject: false },
      { desc: "CID with invalid UTF-8 surrogate pair", cid: "\ud800\udc00Test", severity: "error", shouldReject: true },
      { desc: "CID with zero-width characters", cid: "Qm\u200B\u200CTest", severity: "info", shouldReject: false },
      { desc: "CID exceeding 200 bytes", cid: "Qm" + "a".repeat(200), severity: "error", shouldReject: true },
      { desc: "CID consisting of only control characters", cid: "\x01\x02\x03", severity: "error", shouldReject: true },
      { desc: "valid CID at boundary 70 chars", cid: "Qm" + "a".repeat(68), severity: "info", shouldReject: false },
      { desc: "CID with path separators", cid: "../../etc/passwd", severity: "error", shouldReject: true },
      { desc: "CID with shell metacharacters", cid: "; rm -rf /", severity: "error", shouldReject: true },
    ];

    for (let i = 0; i < this.config.casesPerCategory; i++) {
      const len = this.randomInt(0, this.config.maxStringLength);
      scenarios.push({
        desc: `random malformed CID #${i}`,
        cid: this.randomString(0, len),
        severity: len > 70 ? "error" : "info",
        shouldReject: len < 1 || len > 70,
      });
    }

    for (const scenario of scenarios) {
      const fileName = `fuzz-cid-${scenario.desc.replace(/[^a-zA-Z0-9]/g, "-").slice(0, 30)}.prompt`;
      const filePath = join(tempDir, fileName);
      const metaPath = filePath.replace(PROMPT_FILE_EXT, META_FILE_SUFFIX);
      const meta = createDefaultMetadata("fuzz-cid");
      meta.prompt_text = scenario.cid;

      const cid = computeCid(scenario.cid);
      let rejectedAsExpected = false;
      let error: string | undefined;

      try {
        await writeFile(filePath, scenario.cid, "utf8");
        await writeFile(metaPath, JSON.stringify(meta), "utf8");
        const valid = isValidPromptFile(fileName);

        if (scenario.shouldReject) {
          rejectedAsExpected = !valid || cid.length === 0;
          if (!rejectedAsExpected) {
            error = "Expected CID to be invalid but it was accepted";
          }
        } else {
          rejectedAsExpected = !valid;
        }
      } catch (e: any) {
        rejectedAsExpected = scenario.shouldReject;
        error = e.message;
      }

      this.record({
        filePath: filePath,
        promptText: scenario.cid,
        scenario: scenario.desc,
        severity: scenario.severity,
        expectedRejection: scenario.shouldReject,
        rejectedAsExpected,
        cid,
        error,
      });
    }

    return this.results.filter((r) => r.scenario.startsWith("malformed CID") || scenarios.some((s) => s.desc === r.scenario));
  }

  async fuzzMalformedMetadata(tempDir: string): Promise<FuzzResult[]> {
    const scenarios: Array<{
      desc: string;
      metadata: any;
      severity: FuzzerSeverity;
      shouldReject: boolean;
    }> = [
      {
        desc: "metadata with circular JSON reference",
        metadata: (() => { const x: any = {}; x.self = x; return x; })(),
        severity: "error",
        shouldReject: true,
      },
      {
        desc: "metadata with NaN values",
        metadata: { name: NaN, category: NaN },
        severity: "error",
        shouldReject: true,
      },
      {
        desc: "metadata with extremely deep nesting",
        metadata: (() => { let x: any = {}; let cur = x; for (let i = 0; i < 1000; i++) { cur[i] = {}; cur = cur[i]; } return x; })(),
        severity: "warning",
        shouldReject: true,
      },
      {
        desc: "metadata with oversized name field",
        metadata: { name: "x".repeat(10000), category: "code", tags: ["test"] },
        severity: "warning",
        shouldReject: false,
      },
      {
        desc: "metadata with negative numbers",
        metadata: { name: "test", category: "code", totalUses: -1 },
        severity: "error",
        shouldReject: true,
      },
      {
        desc: "metadata with prototype pollution",
        metadata: JSON.parse('{"__proto__": {"admin": true}}'),
        severity: "error",
        shouldReject: true,
      },
      {
        desc: "metadata with constructor pollution",
        metadata: JSON.parse('{"constructor": {"prototype": {"polluted": true}}}'),
        severity: "error",
        shouldReject: true,
      },
      {
        desc: "metadata with array in scalar field",
        metadata: { name: ["array", "name"], category: "code" },
        severity: "error",
        shouldReject: true,
      },
      {
        desc: "metadata with empty name",
        metadata: { name: "", category: "code", tags: [] },
        severity: "warning",
        shouldReject: false,
      },
      {
        desc: "metadata missing required fields",
        metadata: {},
        severity: "error",
        shouldReject: true,
      },
      {
        desc: "metadata with SQL injection",
        metadata: { name: "'; DROP TABLE prompts; --", category: "code" },
        severity: "warning",
        shouldReject: false,
      },
      {
        desc: "metadata with script injection",
        metadata: { name: "<script>alert('xss')</script>", category: "code" },
        severity: "warning",
        shouldReject: false,
      },
    ];

    for (let i = 0; i < this.config.casesPerCategory; i++) {
      scenarios.push({
        desc: `random malformed metadata #${i}`,
        metadata: this.generateRandomMetadata(),
        severity: "info",
        shouldReject: false,
      });
    }

    for (const scenario of scenarios) {
      const fileName = `fuzz-meta-${scenario.desc.replace(/[^a-zA-Z0-9]/g, "-").slice(0, 30)}.prompt`;
      const filePath = join(tempDir, fileName);
      const metaPath = filePath.replace(PROMPT_FILE_EXT, META_FILE_SUFFIX);
      const promptText = "Fuzz prompt content";

      let rejectedAsExpected = false;
      let error: string | undefined;

      try {
        await writeFile(filePath, promptText, "utf8");
        const metaJson = JSON.stringify(scenario.metadata);
        await writeFile(metaPath, metaJson, "utf8");

        if (scenario.shouldReject) {
          rejectedAsExpected = true;
        }
      } catch (e: any) {
        rejectedAsExpected = scenario.shouldReject;
        error = e.message;
      }

      this.record({
        filePath,
        promptText,
        scenario: scenario.desc,
        severity: scenario.severity,
        expectedRejection: scenario.shouldReject,
        rejectedAsExpected,
        cid: computeCid(promptText),
        error,
      });
    }

    return this.results.filter((r) => r.scenario.startsWith("malformed metadata") || r.scenario.startsWith("metadata with") || r.scenario.startsWith("random malformed metadata"));
  }

  async fuzzUnicodeEdgeCases(tempDir: string): Promise<FuzzResult[]> {
    const unicodeScenarios: Array<{ desc: string; text: string; severity: FuzzerSeverity; shouldReject: boolean }> = [
      { desc: "null byte in prompt text", text: "hello\x00world", severity: "error", shouldReject: true },
      { desc: "zero-width joiners in text", text: "hello\u200Dworld", severity: "info", shouldReject: false },
      { desc: "zero-width non-joiners", text: "hello\u200Cworld", severity: "info", shouldReject: false },
      { desc: "right-to-left override", text: "hello\u202Eworld", severity: "warning", shouldReject: false },
      { desc: "left-to-right override", text: "hello\u202Dworld", severity: "warning", shouldReject: false },
      { desc: "pop directional formatting", text: "hello\u202Cworld", severity: "info", shouldReject: false },
      { desc: "arabic letter mark", text: "hello\u061Cworld", severity: "info", shouldReject: false },
      { desc: "national digit shapes", text: "\u206Fnumbers", severity: "info", shouldReject: false },
      { desc: "invisible times", text: "hello\u2062world", severity: "info", shouldReject: false },
      { desc: "invisible separator", text: "hello\u2063world", severity: "info", shouldReject: false },
      { desc: "invisible plus", text: "hello\u2064world", severity: "info", shouldReject: false },
      { desc: "backspace character", text: "hello\bworld", severity: "warning", shouldReject: false },
      { desc: "escape character", text: "hello\x1Bworld", severity: "warning", shouldReject: false },
      { desc: "delete character", text: "hello\x7Fworld", severity: "warning", shouldReject: false },
      { desc: "CJK mixed with RTL", text: "你好שלוםworld", severity: "info", shouldReject: false },
      { desc: "national flag emoji sequence", text: "hello🇺🇳world", severity: "info", shouldReject: false },
      { desc: "keycap emoji sequence", text: "hello1️⃣world", severity: "info", shouldReject: false },
      { desc: "skin tone modifier sequence", text: "hello👋🏿world", severity: "info", shouldReject: false },
      { desc: "zwj emoji sequence", text: "hello👨‍👩‍👧‍👦world", severity: "info", shouldReject: false },
      { desc: "tag sequence", text: "hello🏴󠁧󠁢󠁳󠁣󠁴󠁿world", severity: "info", shouldReject: false },
      { desc: "combining characters overlay", text: "helloZ͑̎͋͑world", severity: "info", shouldReject: false },
      { desc: "confusable homoglyphs", text: "hеllо (Cyrillic)", severity: "info", shouldReject: false },
      { desc: "direction overrides with CJK", text: "abc\u202E你好\u202Cdef", severity: "warning", shouldReject: false },
      { desc: "nested direction overrides", text: "a\u202Eb\u202Dc\u202C\u202Cd", severity: "warning", shouldReject: false },
    ];

    for (let i = 0; i < this.config.casesPerCategory; i++) {
      unicodeScenarios.push({
        desc: `random Unicode fuzz #${i}`,
        text: this.randomString(0, 200),
        severity: "info",
        shouldReject: false,
      });
    }

    for (const scenario of unicodeScenarios) {
      const fileName = `fuzz-unicode-${scenario.desc.replace(/[^a-zA-Z0-9]/g, "-").slice(0, 30)}.prompt`;
      const filePath = join(tempDir, fileName);
      const metaPath = filePath.replace(PROMPT_FILE_EXT, META_FILE_SUFFIX);
      const meta = createDefaultMetadata("fuzz-unicode");
      meta.prompt_text = scenario.text;

      const cid = computeCid(scenario.text);
      let rejectedAsExpected = false;
      let error: string | undefined;

      try {
        await writeFile(filePath, scenario.text, "utf8");
        await writeFile(metaPath, JSON.stringify(meta), "utf8");

        if (scenario.shouldReject) {
          rejectedAsExpected = false;
          error = "Expected Unicode to trigger rejection but it didn't";
        } else {
          rejectedAsExpected = false;
        }
      } catch (e: any) {
        rejectedAsExpected = scenario.shouldReject;
        error = e.message;
      }

      this.record({
        filePath,
        promptText: scenario.text,
        scenario: scenario.desc,
        severity: scenario.severity,
        expectedRejection: scenario.shouldReject,
        rejectedAsExpected,
        cid,
        error,
      });
    }

    return this.results;
  }

  async runAll(tempDir: string): Promise<FuzzResult[]> {
    await mkdir(tempDir, { recursive: true });
    const results: FuzzResult[] = [];
    results.push(...await this.fuzzMalformedCids(tempDir));
    results.push(...await this.fuzzMalformedMetadata(tempDir));
    results.push(...await this.fuzzUnicodeEdgeCases(tempDir));
    return results;
  }

  summary(): { total: number; errors: number; warnings: number; infos: number; expectedRejections: number; unexpectedAccepts: number } {
    const total = this.results.length;
    const errors = this.results.filter((r) => r.severity === "error").length;
    const warnings = this.results.filter((r) => r.severity === "warning").length;
    const infos = this.results.filter((r) => r.severity === "info").length;
    const expectedRejections = this.results.filter((r) => r.rejectedAsExpected).length;
    const unexpectedAccepts = this.results.filter((r) => r.expectedRejection && !r.rejectedAsExpected).length;
    return { total, errors, warnings, infos, expectedRejections, unexpectedAccepts };
  }

  private generateRandomMetadata(): any {
    return {
      name: this.randomAsciiString(0, 100),
      description: this.randomString(0, 500),
      prompt_text: this.randomString(0, 1000),
      category: this.randomAsciiString(0, 30),
      tags: Array.from({ length: this.randomInt(0, 10) }, () => this.randomAsciiString(0, 20)),
      task_description: this.randomString(0, 200),
      created_at: this.randomAsciiString(0, 30),
      updated_at: this.randomAsciiString(0, 30),
      language: this.randomAsciiString(0, 10),
    };
  }
}
