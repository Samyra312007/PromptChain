export type OutputFormat = 'text' | 'json' | 'screen-reader' | 'quiet';

export interface OutputEntry {
  key: string;
  label: string;
  value: string;
  severity?: 'info' | 'success' | 'warning' | 'error';
}

export interface StructuredOutput {
  format: OutputFormat;
  title: string;
  entries: OutputEntry[];
  raw?: Record<string, unknown>;
}

export class AccessibleOutput {
  private format: OutputFormat;

  constructor(format: OutputFormat = 'text') {
    this.format = format;
  }

  setFormat(format: OutputFormat): void {
    this.format = format;
  }

  getFormat(): OutputFormat {
    return this.format;
  }

  render(output: StructuredOutput): string {
    switch (this.format) {
      case 'json':
        return this.renderJson(output);
      case 'screen-reader':
        return this.renderScreenReader(output);
      case 'quiet':
        return this.renderQuiet(output);
      case 'text':
      default:
        return this.renderText(output);
    }
  }

  private renderText(output: StructuredOutput): string {
    const lines: string[] = [output.title, '='.repeat(output.title.length), ''];
    for (const entry of output.entries) {
      const prefix = entry.severity === 'error' ? '✗' :
        entry.severity === 'warning' ? '⚠' :
        entry.severity === 'success' ? '✓' : ' ';
      lines.push(`  ${prefix} ${entry.label}: ${entry.value}`);
    }
    return lines.join('\n');
  }

  private renderJson(output: StructuredOutput): string {
    return JSON.stringify(
      {
        title: output.title,
        entries: output.entries,
        ...output.raw,
      },
      null,
      2,
    );
  }

  private renderScreenReader(output: StructuredOutput): string {
    const parts: string[] = [output.title];
    for (const entry of output.entries) {
      const sev = entry.severity ? `[${entry.severity.toUpperCase()}]` : '';
      parts.push(`${sev} ${entry.label}: ${entry.value}`);
    }
    return parts.join('. ');
  }

  private renderQuiet(output: StructuredOutput): string {
    const critical = output.entries.filter(
      (e) => e.severity === 'error' || e.severity === 'warning',
    );
    if (critical.length === 0) return '';
    return critical
      .map((e) => `[${e.severity?.toUpperCase()}] ${e.label}: ${e.value}`)
      .join('\n');
  }
}
