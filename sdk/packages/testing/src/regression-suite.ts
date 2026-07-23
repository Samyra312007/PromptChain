export interface RegressionTest {
  id: string;
  category: string;
  description: string;
  dateReported: string;
  issueRef?: string;
  run: () => Promise<RegressionTestResult>;
}

export interface RegressionTestResult {
  testId: string;
  passed: boolean;
  error?: string;
  durationMs: number;
  details?: Record<string, any>;
}

export class RegressionSuite {
  private tests: RegressionTest[] = [];
  private results: RegressionTestResult[] = [];
  private log: string[] = [];

  register(test: RegressionTest): void {
    this.tests.push(test);
  }

  registerBatch(tests: RegressionTest[]): void {
    for (const test of tests) {
      this.register(test);
    }
  }

  getTests(): RegressionTest[] { return [...this.tests]; }
  getResults(): RegressionTestResult[] { return [...this.results]; }
  getLog(): string[] { return [...this.log]; }

  private logMessage(msg: string): void {
    this.log.push(msg);
  }

  async runTest(test: RegressionTest): Promise<RegressionTestResult> {
    const start = Date.now();
    try {
      const result = await test.run();
      const finalResult: RegressionTestResult = {
        ...result,
        testId: test.id,
        durationMs: Date.now() - start,
      };
      if (finalResult.passed) {
        this.logMessage(`PASS: [${test.category}] ${test.id} - ${test.description}`);
      } else {
        this.logMessage(`FAIL: [${test.category}] ${test.id} - ${test.description}: ${finalResult.error}`);
      }
      return finalResult;
    } catch (e: any) {
      const failResult: RegressionTestResult = {
        testId: test.id,
        passed: false,
        error: e.message,
        durationMs: Date.now() - start,
      };
      this.logMessage(`FAIL: [${test.category}] ${test.id} - ${test.description}: ${e.message}`);
      return failResult;
    }
  }

  async runAll(): Promise<{
    total: number;
    passed: number;
    failed: number;
    results: RegressionTestResult[];
    log: string[];
  }> {
    this.results = [];
    this.log = [];

    this.logMessage(`Running ${this.tests.length} regression tests...`);

    for (const test of this.tests) {
      const result = await this.runTest(test);
      this.results.push(result);
    }

    const passed = this.results.filter((r) => r.passed).length;
    const failed = this.results.filter((r) => !r.passed).length;

    this.logMessage(`\n=== Regression Suite Complete ===`);
    this.logMessage(`Total: ${this.results.length}, Passed: ${passed}, Failed: ${failed}`);

    return {
      total: this.results.length,
      passed,
      failed,
      results: this.results,
      log: this.log,
    };
  }

  runByCategory(category: string): Promise<{
    total: number;
    passed: number;
    failed: number;
    results: RegressionTestResult[];
    log: string[];
  }> {
    const filtered = this.tests.filter((t) => t.category === category);
    return this.runFiltered(filtered, `category "${category}"`);
  }

  private async runFiltered(
    filteredTests: RegressionTest[],
    label: string
  ): Promise<{
    total: number;
    passed: number;
    failed: number;
    results: RegressionTestResult[];
    log: string[];
  }> {
    this.results = [];
    this.log = [];

    this.logMessage(`Running ${filteredTests.length} tests (${label})...`);

    for (const test of filteredTests) {
      const result = await this.runTest(test);
      this.results.push(result);
    }

    const passed = this.results.filter((r) => r.passed).length;
    const failed = this.results.filter((r) => !r.passed).length;

    return {
      total: this.results.length,
      passed,
      failed,
      results: this.results,
      log: this.log,
    };
  }

  createPublishRegressionTest(
    id: string,
    description: string,
    category: string,
    dateReported: string,
    issueRef: string | undefined,
    fn: () => Promise<boolean>,
    errorMessage?: string,
  ): RegressionTest {
    return {
      id,
      category,
      description,
      dateReported,
      issueRef,
      run: async () => {
        const passed = await fn();
        return {
          testId: id,
          passed,
          error: passed ? undefined : errorMessage,
          durationMs: 0,
          details: { category, dateReported },
        };
      },
    };
  }
}

export const REGRESSION_CATEGORIES = {
  KERNEL: "kernel",
  CURATION: "curation",
  TOKEN_ECONOMICS: "token-economics",
  GOVERNANCE: "governance",
  RLHF: "rlhf",
  STORAGE: "storage",
  NETWORK: "network",
  CACHE: "cache",
  COMPILER: "compiler",
  CLI: "cli",
  SDK: "sdk",
  SECURITY: "security",
} as const;
