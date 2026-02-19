/**
 * Smartclaw — Zod-validated configuration.
 *
 * Loads configuration from environment variables and validates
 * it using Zod schemas. Fail-fast on invalid config.
 */

import { z } from "zod";

const GatewayConfigSchema = z.object({
  port: z.coerce.number().int().min(1).max(65535).default(3000),
  host: z.string().default("0.0.0.0"),
  maxConnections: z.coerce.number().int().min(1).default(100),
});

const SecurityConfigSchema = z.object({
  networkIsolation: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .default("false"),
  filesystemRestrict: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .default("true"),
  allowedPaths: z
    .string()
    .transform((v) => v.split(",").map((p) => p.trim()))
    .default("/tmp"),
  rateLimitRpm: z.coerce.number().int().min(0).default(60),
  toolConfirmation: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .default("true"),
  auditLogPath: z.string().default("./logs/audit.jsonl"),
});

const SandboxConfigSchema = z.object({
  provider: z.enum(["process", "docker", "container"]).default("process"),
  memoryLimitMb: z.coerce.number().int().min(64).default(512),
  timeoutMs: z.coerce.number().int().min(1000).default(30000),
});

const PromptConfigSchema = z.object({
  tokenBudget: z.coerce.number().int().min(256).default(4096),
  qualityGateEnabled: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .default("true"),
});

const SmartclawConfigSchema = z.object({
  gateway: GatewayConfigSchema,
  security: SecurityConfigSchema,
  sandbox: SandboxConfigSchema,
  prompt: PromptConfigSchema,
  logLevel: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export type SmartclawConfig = z.infer<typeof SmartclawConfigSchema>;
export type GatewayConfig = z.infer<typeof GatewayConfigSchema>;
export type SecurityConfig = z.infer<typeof SecurityConfigSchema>;
export type SandboxConfig = z.infer<typeof SandboxConfigSchema>;
export type PromptConfig = z.infer<typeof PromptConfigSchema>;

/**
 * Load and validate configuration from environment variables.
 *
 * @param env - Environment variable map (defaults to `process.env`)
 * @returns Validated Smartclaw configuration
 * @throws {z.ZodError} if any value is invalid
 */
export function loadConfig(
  env: Record<string, string | undefined> = process.env as Record<
    string,
    string | undefined
  >,
): SmartclawConfig {
  return SmartclawConfigSchema.parse({
    gateway: {
      port: env.GATEWAY_PORT,
      host: env.GATEWAY_HOST,
      maxConnections: env.GATEWAY_MAX_CONNECTIONS,
    },
    security: {
      networkIsolation: env.SECURITY_NETWORK_ISOLATION,
      filesystemRestrict: env.SECURITY_FILESYSTEM_RESTRICT,
      allowedPaths: env.SECURITY_ALLOWED_PATHS,
      rateLimitRpm: env.SECURITY_RATE_LIMIT_RPM,
      toolConfirmation: env.SECURITY_TOOL_CONFIRMATION,
      auditLogPath: env.SECURITY_AUDIT_LOG_PATH,
    },
    sandbox: {
      provider: env.SANDBOX_PROVIDER,
      memoryLimitMb: env.SANDBOX_MEMORY_LIMIT_MB,
      timeoutMs: env.SANDBOX_TIMEOUT_MS,
    },
    prompt: {
      tokenBudget: env.PROMPT_TOKEN_BUDGET,
      qualityGateEnabled: env.PROMPT_QUALITY_GATE_ENABLED,
    },
    logLevel: env.LOG_LEVEL,
  });
}
