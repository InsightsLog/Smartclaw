/**
 * Smartclaw — Structured audit logger (from Trustclaw).
 *
 * Logs all tool calls, message sends, and security events
 * using structured JSON entries with severity levels.
 * Optionally writes entries to a JSONL file for persistence.
 */

import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { AuditEntry, AuditSeverity } from "../types.js";

/** Options for configuring the audit logger. */
export interface AuditLoggerOptions {
  maxEntries?: number;
  filePath?: string;
}

/**
 * Structured audit logger that records security-relevant events.
 */
export class AuditLogger {
  private entries: AuditEntry[] = [];
  private readonly maxEntries: number;
  private readonly filePath?: string;

  constructor(options: AuditLoggerOptions | number = 10_000) {
    if (typeof options === "number") {
      this.maxEntries = options;
    } else {
      this.maxEntries = options.maxEntries ?? 10_000;
      this.filePath = options.filePath;
      if (this.filePath) {
        try {
          mkdirSync(dirname(this.filePath), { recursive: true });
        } catch {
          // Directory may already exist — that's fine
        }
      }
    }
  }

  /** Log an audit event. */
  log(
    severity: AuditSeverity,
    event: string,
    actor: string,
    detail: Record<string, unknown> = {},
  ): AuditEntry {
    const entry: AuditEntry = {
      timestamp: Date.now(),
      severity,
      event,
      actor,
      detail,
    };
    this.entries.push(entry);

    // Evict oldest entries when the buffer is full
    if (this.entries.length > this.maxEntries) {
      this.entries.shift();
    }

    // Persist to file if configured
    if (this.filePath) {
      try {
        appendFileSync(this.filePath, JSON.stringify(entry) + "\n");
      } catch {
        // Swallow write errors to avoid breaking the application
      }
    }

    return entry;
  }

  /** Convenience: log at info level. */
  info(event: string, actor: string, detail?: Record<string, unknown>): AuditEntry {
    return this.log("info", event, actor, detail);
  }

  /** Convenience: log at warn level. */
  warn(event: string, actor: string, detail?: Record<string, unknown>): AuditEntry {
    return this.log("warn", event, actor, detail);
  }

  /** Convenience: log at error level. */
  error(event: string, actor: string, detail?: Record<string, unknown>): AuditEntry {
    return this.log("error", event, actor, detail);
  }

  /** Convenience: log at critical level. */
  critical(event: string, actor: string, detail?: Record<string, unknown>): AuditEntry {
    return this.log("critical", event, actor, detail);
  }

  /** Retrieve entries, optionally filtered by severity. */
  getEntries(severity?: AuditSeverity): AuditEntry[] {
    if (!severity) return [...this.entries];
    return this.entries.filter((e) => e.severity === severity);
  }

  /** Serialize all entries to a JSONL string (one JSON object per line). */
  toJsonl(): string {
    return this.entries.map((e) => JSON.stringify(e)).join("\n");
  }

  /** Clear all stored entries. */
  clear(): void {
    this.entries = [];
  }

  /** Number of stored entries. */
  get size(): number {
    return this.entries.length;
  }
}
