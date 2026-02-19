import { describe, it, expect, beforeEach } from "vitest";
import { Smartclaw, loadConfig } from "../src/index.js";
import type { Message, SmartclawConfig } from "../src/index.js";

function makeConfig(overrides: Partial<SmartclawConfig> = {}): SmartclawConfig {
  return loadConfig({
    GATEWAY_PORT: "3001",
    SECURITY_RATE_LIMIT_RPM: "100",
    PROMPT_QUALITY_GATE_ENABLED: "true",
    ...Object.fromEntries(
      Object.entries(overrides).map(([k, v]) => [k, String(v)]),
    ),
  });
}

function makeMessage(content: string, id = "msg-1"): Message {
  return {
    id,
    channelId: "ch-1",
    sessionId: "sess-1",
    sender: "user-1",
    content,
    timestamp: Date.now(),
  };
}

describe("Smartclaw Integration", () => {
  let claw: Smartclaw;

  beforeEach(() => {
    claw = new Smartclaw(makeConfig());
  });

  it("initializes all subsystems", () => {
    expect(claw.gateway).toBeDefined();
    expect(claw.router).toBeDefined();
    expect(claw.audit).toBeDefined();
    expect(claw.sandbox).toBeDefined();
    expect(claw.policy).toBeDefined();
    expect(claw.promptEngine).toBeDefined();
    expect(claw.skills).toBeDefined();
    expect(claw.skillLoader).toBeDefined();
  });

  it("registers built-in skill factories on construction", () => {
    expect(claw.skillLoader.size).toBeGreaterThanOrEqual(4);
    expect(claw.skillLoader.listFactories()).toContain("calculator");
    expect(claw.skillLoader.listFactories()).toContain("echo");
    expect(claw.skillLoader.listFactories()).toContain("help");
    expect(claw.skillLoader.listFactories()).toContain("summarize");
  });

  it("starts and stops the gateway", async () => {
    await claw.start();
    expect(claw.gateway.isRunning).toBe(true);
    await claw.stop();
    expect(claw.gateway.isRunning).toBe(false);
  });

  it("processes a general message end-to-end", async () => {
    const result = await claw.processMessage(makeMessage("hello"));
    expect(result.messageId).toBe("msg-1");
    expect(result.response).toBeDefined();
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("processes a math message and uses calculator skill", async () => {
    const result = await claw.processMessage(makeMessage("calculate 2 + 2"));
    expect(result.skillsUsed).toContain("calculator");
    expect(result.response).toContain("calculator");
  });

  it("processes a writing message and uses summarize skill", async () => {
    const result = await claw.processMessage(makeMessage("write a draft of a blog post about AI"));
    expect(result.skillsUsed).toContain("summarize");
  });

  it("creates audit entries during message processing", async () => {
    await claw.processMessage(makeMessage("hello"));
    const entries = claw.audit.getEntries();
    expect(entries.length).toBeGreaterThan(0);
    const processingEntry = entries.find((e) => e.event === "message.processing");
    expect(processingEntry).toBeDefined();
    const processedEntry = entries.find((e) => e.event === "message.processed");
    expect(processedEntry).toBeDefined();
  });

  it("routes messages via the router", async () => {
    claw.router.addRule({
      name: "code-rule",
      channels: [],
      pattern: /code/,
      agentId: "code-agent",
      priority: 10,
    });
    const result = await claw.processMessage(makeMessage("fix this code bug"));
    // Should have routed to code-agent (visible in audit)
    const routeEntry = claw.audit.getEntries().find((e) => e.event === "message.routed");
    expect(routeEntry?.detail.agentId).toBe("code-agent");
    expect(result.messageId).toBe("msg-1");
  });

  it("handles rate limiting gracefully", async () => {
    // Create a config with very low rate limit
    const limitedConfig = loadConfig({
      GATEWAY_PORT: "3002",
      SECURITY_RATE_LIMIT_RPM: "2",
      PROMPT_QUALITY_GATE_ENABLED: "true",
    });
    const limitedClaw = new Smartclaw(limitedConfig);

    await limitedClaw.processMessage(makeMessage("msg 1", "m1"));
    await limitedClaw.processMessage(makeMessage("msg 2", "m2"));
    const result = await limitedClaw.processMessage(makeMessage("msg 3", "m3"));

    expect(result.response).toContain("Rate limit");
    expect(result.skillsUsed).toEqual([]);
  });

  it("returns token count in result", async () => {
    const result = await claw.processMessage(makeMessage("hello world"));
    expect(result.tokenCount).toBeGreaterThan(0);
  });
});
