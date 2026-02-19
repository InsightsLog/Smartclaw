/**
 * Smartclaw — Shared types and interfaces.
 *
 * Central type definitions used across gateway, channels, security,
 * prompt engine, and skills subsystems.
 */

/** Unique identifier type. */
export type Id = string;

/** Supported channel types. */
export type ChannelType =
  | "whatsapp"
  | "telegram"
  | "slack"
  | "discord"
  | "websocket"
  | "custom";

/** A message flowing through the system. */
export interface Message {
  id: Id;
  channelId: Id;
  sessionId: Id;
  sender: string;
  content: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

/** Result returned after processing a message. */
export interface MessageResult {
  messageId: Id;
  response: string;
  skillsUsed: string[];
  tokenCount: number;
  durationMs: number;
}

/** Severity levels for audit events. */
export type AuditSeverity = "info" | "warn" | "error" | "critical";

/** A structured audit log entry. */
export interface AuditEntry {
  timestamp: number;
  severity: AuditSeverity;
  event: string;
  actor: string;
  detail: Record<string, unknown>;
}

/** A skill definition. */
export interface SkillDefinition {
  name: string;
  domain: string;
  description: string;
  version?: string;
  execute: (input: SkillInput) => Promise<SkillOutput>;
}

/** Input passed to a skill's execute function. */
export interface SkillInput {
  query: string;
  context?: Record<string, unknown>;
}

/** Output returned by a skill. */
export interface SkillOutput {
  result: string;
  metadata?: Record<string, unknown>;
}

/** Security policy rule. */
export interface PolicyRule {
  action: "allow" | "deny" | "confirm";
  resource: string;
  pattern: string;
}

/** Sandbox execution options. */
export interface SandboxOptions {
  memoryLimitMb: number;
  timeoutMs: number;
  networkAccess: boolean;
  allowedPaths: string[];
}

/** Sandbox execution result. */
export interface SandboxResult {
  success: boolean;
  output: string;
  exitCode: number;
  durationMs: number;
}

/** Intent analysis result from the triangulator. */
export interface IntentAnalysis {
  domain: string;
  complexity: "simple" | "moderate" | "complex";
  requiresSkills: boolean;
  confidence: number;
  userLevel: "beginner" | "intermediate" | "expert";
  tone: "casual" | "formal" | "technical";
}

/** Quality gate result. */
export interface QualityGateResult {
  passed: boolean;
  stage: string;
  reason?: string;
}
