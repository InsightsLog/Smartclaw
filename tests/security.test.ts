import { describe, it, expect, beforeEach } from "vitest";
import { AuditLogger } from "../src/security/audit.js";
import { SandboxManager } from "../src/security/sandbox.js";
import { SecurityPolicy } from "../src/security/policy.js";

describe("AuditLogger", () => {
  let audit: AuditLogger;

  beforeEach(() => {
    audit = new AuditLogger();
  });

  it("logs entries with correct severity", () => {
    audit.info("test.event", "alice");
    audit.warn("test.warning", "bob");
    audit.error("test.error", "charlie");
    audit.critical("test.critical", "dave");

    expect(audit.size).toBe(4);
    expect(audit.getEntries("info")).toHaveLength(1);
    expect(audit.getEntries("critical")).toHaveLength(1);
  });

  it("returns structured entries", () => {
    const entry = audit.info("tool.execute", "agent_1", { tool: "grep" });
    expect(entry.timestamp).toBeGreaterThan(0);
    expect(entry.severity).toBe("info");
    expect(entry.event).toBe("tool.execute");
    expect(entry.actor).toBe("agent_1");
    expect(entry.detail).toEqual({ tool: "grep" });
  });

  it("serializes to JSONL", () => {
    audit.info("a", "x");
    audit.warn("b", "y");
    const lines = audit.toJsonl().split("\n");
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0]).event).toBe("a");
  });

  it("evicts old entries when max is exceeded", () => {
    const small = new AuditLogger(3);
    small.info("1", "x");
    small.info("2", "x");
    small.info("3", "x");
    small.info("4", "x");
    expect(small.size).toBe(3);
    expect(small.getEntries()[0].event).toBe("2");
  });

  it("clears all entries", () => {
    audit.info("a", "x");
    audit.clear();
    expect(audit.size).toBe(0);
  });
});

describe("SandboxManager", () => {
  let sandbox: SandboxManager;

  beforeEach(() => {
    sandbox = new SandboxManager();
  });

  it("creates sandboxes with defaults", () => {
    const s = sandbox.createSandbox();
    expect(s.id).toMatch(/^sandbox_/);
    expect(s.options.memoryLimitMb).toBe(512);
    expect(s.destroyed).toBe(false);
  });

  it("creates sandboxes with custom options", () => {
    const s = sandbox.createSandbox({ memoryLimitMb: 256, networkAccess: true });
    expect(s.options.memoryLimitMb).toBe(256);
    expect(s.options.networkAccess).toBe(true);
  });

  it("destroys sandboxes", () => {
    const s = sandbox.createSandbox();
    expect(sandbox.destroySandbox(s.id)).toBe(true);
    expect(sandbox.get(s.id)).toBeUndefined();
    expect(sandbox.size).toBe(0);
  });

  it("executes functions in sandbox", async () => {
    const s = sandbox.createSandbox();
    const result = await sandbox.executeInSandbox(s.id, async () => "hello");
    expect(result.success).toBe(true);
    expect(result.output).toBe("hello");
    expect(result.exitCode).toBe(0);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("returns error for missing sandbox", async () => {
    const result = await sandbox.executeInSandbox("nope", async () => "x");
    expect(result.success).toBe(false);
    expect(result.output).toBe("Sandbox not found");
  });

  it("catches execution errors", async () => {
    const s = sandbox.createSandbox();
    const result = await sandbox.executeInSandbox(s.id, async () => {
      throw new Error("boom");
    });
    expect(result.success).toBe(false);
    expect(result.output).toBe("boom");
    expect(result.exitCode).toBe(1);
  });
});

describe("SecurityPolicy", () => {
  it("blocks network when isolation is on", () => {
    const policy = new SecurityPolicy({ networkIsolation: true });
    const result = policy.checkNetwork("example.com");
    expect(result.allowed).toBe(false);
  });

  it("allows network when isolation is off", () => {
    const policy = new SecurityPolicy({ networkIsolation: false });
    const result = policy.checkNetwork("example.com");
    expect(result.allowed).toBe(true);
  });

  it("blocks paths outside allowed list", () => {
    const policy = new SecurityPolicy({
      filesystemRestrict: true,
      allowedPaths: ["/tmp", "/home"],
    });
    expect(policy.checkFilePath("/tmp/file.txt").allowed).toBe(true);
    expect(policy.checkFilePath("/etc/passwd").allowed).toBe(false);
  });

  it("allows all paths when restriction is off", () => {
    const policy = new SecurityPolicy({ filesystemRestrict: false });
    expect(policy.checkFilePath("/etc/passwd").allowed).toBe(true);
  });

  it("requires confirmation for tool execution", () => {
    const policy = new SecurityPolicy({ toolConfirmation: true });
    const result = policy.checkToolExecution("rm");
    expect(result.allowed).toBe(true);
    expect(result.requiresConfirmation).toBe(true);
  });

  it("skips confirmation when disabled", () => {
    const policy = new SecurityPolicy({ toolConfirmation: false });
    const result = policy.checkToolExecution("ls");
    expect(result.requiresConfirmation).toBe(false);
  });

  it("enforces rate limiting", () => {
    const policy = new SecurityPolicy({ rateLimitRpm: 3 });
    expect(policy.checkRateLimit().allowed).toBe(true);
    expect(policy.checkRateLimit().allowed).toBe(true);
    expect(policy.checkRateLimit().allowed).toBe(true);
    expect(policy.checkRateLimit().allowed).toBe(false);
  });

  it("applies custom deny rules", () => {
    const policy = new SecurityPolicy({ networkIsolation: false });
    policy.addRule({ action: "deny", resource: "network", pattern: "evil\\.com" });
    expect(policy.checkNetwork("evil.com").allowed).toBe(false);
    expect(policy.checkNetwork("good.com").allowed).toBe(true);
  });

  it("creates from config", () => {
    const policy = SecurityPolicy.fromConfig({
      networkIsolation: true,
      filesystemRestrict: true,
      allowedPaths: ["/tmp"],
      rateLimitRpm: 10,
      toolConfirmation: false,
      auditLogPath: "./logs/audit.jsonl",
    });
    expect(policy.checkNetwork("x.com").allowed).toBe(false);
  });
});
