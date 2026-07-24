import { createHash } from "crypto";
import { readFile } from "fs/promises";
import { readdir } from "fs/promises";
import { join, extname } from "path";
import { computeCid, isValidPromptFile, readPromptFile } from "@promptchain/storage";
import {
  CrossProtocolFormat,
  CrossProtocolImportResult,
  CrossProtocolImportSummary,
} from "./types";

export class CrossProtocolImporter {
  async import(
    source: string,
    format?: CrossProtocolFormat,
  ): Promise<CrossProtocolImportSummary> {
    const resolvedFormat = format || (await this.detectFormat(source));
    const stat = await (await import("fs")).promises.stat(source);
    if (stat.isDirectory()) {
      return this.importDirectory(source);
    }
    switch (resolvedFormat) {
      case "promptbase-csv":
        return this.importPromptBaseCsv(source);
      case "flowgpt-json":
        return this.importFlowGptJson(source);
      case "generic-json":
        return this.importGenericJson(source);
      default:
        return this.importGenericJson(source);
    }
  }

  private async detectFormat(source: string): Promise<CrossProtocolFormat> {
    const stat = await (await import("fs")).promises.stat(source).catch(() => null);
    if (stat && stat.isDirectory()) return "generic-json";
    const ext = extname(source).toLowerCase();
    if (ext === ".csv") return "promptbase-csv";
    if (ext === ".json") {
      const content = await readFile(source, "utf8").catch(() => "");
      if (content.includes("flowgpt") || content.includes("FlowGPT")) return "flowgpt-json";
      if (content.includes("PromptBase") || content.includes("promptbase")) return "promptbase-csv";
      return "generic-json";
    }
    return "generic-json";
  }

  private async importDirectory(source: string): Promise<CrossProtocolImportSummary> {
    const entries: CrossProtocolImportResult[] = [];
    const errors: string[] = [];

    const files = await readdir(source);
    const promptFiles = files.filter((f) => isValidPromptFile(f));

    for (const file of promptFiles) {
      try {
        const pf = await readPromptFile(join(source, file));
        entries.push({
          filename: pf.filename,
          promptText: pf.promptText,
          metadata: pf.metadata as unknown as Record<string, unknown>,
          cid: pf.cid,
        });
      } catch (err) {
        errors.push(`Failed to read ${file}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return {
      format: "generic-json",
      totalImported: entries.length,
      totalSkipped: 0,
      totalErrors: errors.length,
      entries,
      errors,
    };
  }

  private async importPromptBaseCsv(source: string): Promise<CrossProtocolImportSummary> {
    const content = await readFile(source, "utf8");
    const lines = content.split("\n").filter((l) => l.trim());
    if (lines.length === 0) {
      return {
        format: "promptbase-csv",
        totalImported: 0,
        totalSkipped: 0,
        totalErrors: 0,
        entries: [],
        errors: [],
      };
    }

    const headers = this.parseCsvLine(lines[0]);
    const entries: CrossProtocolImportResult[] = [];
    const errors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      try {
        const fields = this.parseCsvLine(lines[i]);
        const row = this.zipHeaders(headers, fields);
        const promptText = row.prompt || row.text || row.content || "";
        const name = row.title || row.name || `prompt_${i}`;
        const metadata: Record<string, unknown> = {
          name,
          description: row.description || "",
          prompt_text: promptText,
          category: row.category || "general",
          tags: row.tags ? row.tags.split(",").map((t: string) => t.trim()) : [],
          task_description: row.task || "",
          created_at: row.created_at || new Date().toISOString(),
          updated_at: row.updated_at || new Date().toISOString(),
          language: row.language || "en",
          source: `PromptBase:${row.id || ""}`,
        };
        entries.push({
          filename: `${sanitizeFilename(name)}.prompt`,
          promptText,
          metadata,
          cid: computeCid(promptText),
        });
      } catch (err) {
        errors.push(`Failed to parse PromptBase row ${i}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return {
      format: "promptbase-csv",
      totalImported: entries.length,
      totalSkipped: 0,
      totalErrors: errors.length,
      entries,
      errors,
    };
  }

  private async importFlowGptJson(source: string): Promise<CrossProtocolImportSummary> {
    const content = await readFile(source, "utf8");
    let data: any;
    try {
      data = JSON.parse(content);
    } catch {
      return {
        format: "flowgpt-json",
        totalImported: 0,
        totalSkipped: 0,
        totalErrors: 1,
        entries: [],
        errors: ["Invalid JSON in FlowGPT file"],
      };
    }

    const items = Array.isArray(data) ? data : data.prompts || data.data || [];
    const entries: CrossProtocolImportResult[] = [];
    const errors: string[] = [];

    for (let i = 0; i < items.length; i++) {
      try {
        const item = items[i];
        const promptText = item.prompt || item.text || item.content || item.message || "";
        const name = item.title || item.name || `flowgpt_${i}`;
        const metadata: Record<string, unknown> = {
          name,
          description: item.description || "",
          prompt_text: promptText,
          category: item.category || "general",
          tags: Array.isArray(item.tags) ? item.tags : [],
          task_description: item.task || item.instruction || "",
          created_at: item.created_at || item.createdAt || new Date().toISOString(),
          updated_at: item.updated_at || item.updatedAt || new Date().toISOString(),
          language: item.language || "en",
          source: `FlowGPT:${item.id || ""}`,
          model: item.model || item.target_model || "",
        };
        entries.push({
          filename: `${sanitizeFilename(name)}.prompt`,
          promptText,
          metadata,
          cid: computeCid(promptText),
        });
      } catch (err) {
        errors.push(`Failed to parse FlowGPT item ${i}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return {
      format: "flowgpt-json",
      totalImported: entries.length,
      totalSkipped: 0,
      totalErrors: errors.length,
      entries,
      errors,
    };
  }

  private async importGenericJson(source: string): Promise<CrossProtocolImportSummary> {
    const content = await readFile(source, "utf8");
    let data: any;
    try {
      data = JSON.parse(content);
    } catch {
      return {
        format: "generic-json",
        totalImported: 0,
        totalSkipped: 0,
        totalErrors: 1,
        entries: [],
        errors: ["Invalid JSON"],
      };
    }

    const items = Array.isArray(data) ? data : data.prompts || data.entries || data.data || [data];
    const entries: CrossProtocolImportResult[] = [];
    const errors: string[] = [];

    for (let i = 0; i < items.length; i++) {
      try {
        const item = items[i];
        const promptText = typeof item === "string" ? item : (item.prompt || item.text || item.content || item.message || "");
        const name = item.name || item.title || `prompt_${i}`;
        const metadata: Record<string, unknown> = typeof item === "string" ? {
          name: `prompt_${i}`,
          description: "",
          prompt_text: promptText,
          category: "general",
          tags: [],
          task_description: "",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          language: "en",
        } : {
          name,
          description: item.description || "",
          prompt_text: promptText,
          category: item.category || "general",
          tags: Array.isArray(item.tags) ? item.tags : [],
          task_description: item.task_description || item.task || "",
          created_at: item.created_at || item.createdAt || new Date().toISOString(),
          updated_at: item.updated_at || item.updatedAt || new Date().toISOString(),
          language: item.language || "en",
        };
        entries.push({
          filename: `${sanitizeFilename(name)}.prompt`,
          promptText,
          metadata,
          cid: computeCid(promptText),
        });
      } catch (err) {
        errors.push(`Failed to parse item ${i}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return {
      format: "generic-json",
      totalImported: entries.length,
      totalSkipped: 0,
      totalErrors: errors.length,
      entries,
      errors,
    };
  }

  private parseCsvLine(line: string): string[] {
    const fields: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === "," && !inQuotes) {
        fields.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    fields.push(current.trim());
    return fields;
  }

  private zipHeaders(headers: string[], fields: string[]): Record<string, string> {
    const row: Record<string, string> = {};
    for (let i = 0; i < headers.length && i < fields.length; i++) {
      row[headers[i].toLowerCase()] = fields[i];
    }
    return row;
  }
}

function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .toLowerCase()
    .slice(0, 100) || "unnamed";
}
