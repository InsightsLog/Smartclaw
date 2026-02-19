/**
 * Smartclaw — Security policy engine (from Trustclaw).
 *
 * Defines and enforces security policies:
 * - Tool execution confirmation
 * - Network isolation mode
 * - File system restrictions
 * - Rate limiting
 */

import type { PolicyRule } from "../types.js";
import type { SecurityConfig } from "../config/config.js";

/** Result of a policy check. */
export interface PolicyCheckResult {
  allowed: boolean;
  requiresConfirmation: boolean;
  reason: string;
}

/**
 * Evaluates security policies against requested actions.
 */
export class SecurityPolicy {
  private rules: PolicyRule[] = [];
  private readonly networkIsolation: boolean;
  private readonly filesystemRestrict: boolean;
  private readonly allowedPaths: string[];
  private readonly rateLimitRpm: number;
  private readonly toolConfirmation: boolean;

  private requestTimestamps: number[] = [];

  constructor(options: {
    networkIsolation?: boolean;
    filesystemRestrict?: boolean;
    allowedPaths?: string[];
    rateLimitRpm?: number;
    toolConfirmation?: boolean;
  } = {}) {
    this.networkIsolation = options.networkIsolation ?? false;
    this.filesystemRestrict = options.filesystemRestrict ?? true;
    this.allowedPaths = options.allowedPaths ?? ["/tmp"];
    this.rateLimitRpm = options.rateLimitRpm ?? 60;
    this.toolConfirmation = options.toolConfirmation ?? true;
  }

  /** Create a policy engine from a validated SecurityConfig. */
  static fromConfig(config: SecurityConfig): SecurityPolicy {
    return new SecurityPolicy({
      networkIsolation: config.networkIsolation,
      filesystemRestrict: config.filesystemRestrict,
      allowedPaths: config.allowedPaths,
      rateLimitRpm: config.rateLimitRpm,
      toolConfirmation: config.toolConfirmation,
    });
  }

  /** Add a custom policy rule. */
  addRule(rule: PolicyRule): void {
    this.rules.push(rule);
  }

  /** Check whether a network request is allowed. */
  checkNetwork(host: string): PolicyCheckResult {
    if (this.networkIsolation) {
      return { allowed: false, requiresConfirmation: false, reason: "Network isolation enabled" };
    }
    return this.evaluateRules("network", host);
  }

  /** Check whether a file path is accessible. */
  checkFilePath(path: string): PolicyCheckResult {
    if (this.filesystemRestrict) {
      const allowed = this.allowedPaths.some((p) => path.startsWith(p));
      if (!allowed) {
        return {
          allowed: false,
          requiresConfirmation: false,
          reason: `Path ${path} is outside allowed paths`,
        };
      }
    }
    return this.evaluateRules("file", path);
  }

  /** Check whether a tool execution is allowed. */
  checkToolExecution(toolName: string): PolicyCheckResult {
    const ruleResult = this.evaluateRules("tool", toolName);
    if (!ruleResult.allowed) return ruleResult;

    if (this.toolConfirmation) {
      return { allowed: true, requiresConfirmation: true, reason: "Tool confirmation required" };
    }
    return ruleResult;
  }

  /** Check rate limiting — returns allowed=false if limit exceeded. */
  checkRateLimit(): PolicyCheckResult {
    const now = Date.now();
    const windowStart = now - 60_000;

    // Prune old timestamps
    this.requestTimestamps = this.requestTimestamps.filter((t) => t > windowStart);

    if (this.requestTimestamps.length >= this.rateLimitRpm) {
      return { allowed: false, requiresConfirmation: false, reason: "Rate limit exceeded" };
    }

    this.requestTimestamps.push(now);
    return { allowed: true, requiresConfirmation: false, reason: "Within rate limit" };
  }

  /** Evaluate custom rules for a resource type. */
  private evaluateRules(resource: string, value: string): PolicyCheckResult {
    for (const rule of this.rules) {
      if (rule.resource !== resource) continue;

      const regex = new RegExp(rule.pattern);
      if (regex.test(value)) {
        if (rule.action === "deny") {
          return { allowed: false, requiresConfirmation: false, reason: `Denied by rule: ${rule.pattern}` };
        }
        if (rule.action === "confirm") {
          return { allowed: true, requiresConfirmation: true, reason: `Confirmation required by rule: ${rule.pattern}` };
        }
      }
    }
    return { allowed: true, requiresConfirmation: false, reason: "Allowed" };
  }
}
