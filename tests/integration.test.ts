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
    expect(claw.agents).toBeDefined();
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
    const result = await claw.processMessage(makeMessage("please write and edit a draft of a blog essay"));
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

describe("Smartclaw Agent Integration", () => {
  let claw: Smartclaw;

  beforeEach(() => {
    claw = new Smartclaw(makeConfig());
  });

  it("registers a default agent on construction", () => {
    expect(claw.agents.has("default-agent")).toBe(true);
    const defaultAgent = claw.agents.get("default-agent")!;
    expect(defaultAgent.name).toBe("Smartclaw");
    expect(defaultAgent.status).toBe("idle");
  });

  it("uses the default agent's system prompt in pipeline", async () => {
    const result = await claw.processMessage(makeMessage("hello"));
    expect(result.response).toContain("Smartclaw");
  });

  it("records interaction in agent memory after processing", async () => {
    await claw.processMessage(makeMessage("hello"));
    const agent = claw.agents.get("default-agent")!;
    expect(agent.memorySize).toBe(2); // user + agent
    expect(agent.memory[0].role).toBe("user");
    expect(agent.memory[0].content).toBe("hello");
    expect(agent.memory[1].role).toBe("agent");
    expect(agent.messagesHandled).toBe(1);
  });

  it("accumulates memory across messages", async () => {
    await claw.processMessage(makeMessage("first message", "m1"));
    await claw.processMessage(makeMessage("second message", "m2"));
    const agent = claw.agents.get("default-agent")!;
    expect(agent.memorySize).toBe(4); // 2 per message
    expect(agent.messagesHandled).toBe(2);
  });

  it("uses custom agent system prompt when routed", async () => {
    claw.agents.register({
      id: "code-agent",
      name: "CodeBot",
      description: "Expert code assistant",
      systemPrompt: "You are CodeBot, an expert programmer.",
      domains: ["code"],
    });
    claw.router.addRule({
      name: "code-rule",
      channels: [],
      pattern: /code/,
      agentId: "code-agent",
      priority: 10,
    });

    const result = await claw.processMessage(makeMessage("fix this code bug"));
    expect(result.response).toContain("CodeBot");

    const codeAgent = claw.agents.get("code-agent")!;
    expect(codeAgent.messagesHandled).toBe(1);
    expect(codeAgent.memorySize).toBeGreaterThan(0);
  });

  it("rejects messages to offline agents", async () => {
    const agent = claw.agents.get("default-agent")!;
    agent.goOffline();

    const result = await claw.processMessage(makeMessage("hello"));
    expect(result.response).toContain("offline");
    expect(result.skillsUsed).toEqual([]);
  });

  it("agent status transitions through processing", async () => {
    const agent = claw.agents.get("default-agent")!;
    expect(agent.status).toBe("idle");
    await claw.processMessage(makeMessage("hello"));
    // After processing completes, agent should be back to idle
    expect(agent.status).toBe("idle");
  });

  it("respects agent skill restrictions", async () => {
    // Register an agent that can only use echo
    claw.agents.register({
      id: "restricted-agent",
      name: "RestrictedBot",
      description: "A restricted agent",
      systemPrompt: "You are restricted.",
      allowedSkills: ["echo"],
    });
    claw.router.addRule({
      name: "restricted-rule",
      channels: [],
      pattern: /calculate/,
      agentId: "restricted-agent",
      priority: 20,
    });

    const result = await claw.processMessage(makeMessage("calculate 2 + 2"));
    // calculator skill should be blocked by the restricted agent
    expect(result.skillsUsed).not.toContain("calculator");
  });

  it("includes agent context from memory in prompt", async () => {
    // Send a first message to build up memory
    await claw.processMessage(makeMessage("my name is Alice", "m1"));
    // Second message should include conversation history in the prompt
    const result = await claw.processMessage(makeMessage("what is my name?", "m2"));
    // The response prompt should contain the earlier context
    expect(result.response).toContain("Alice");
  });

  it("logs agent id in audit entries", async () => {
    await claw.processMessage(makeMessage("hello"));
    const processedEntry = claw.audit.getEntries().find((e) => e.event === "message.processed");
    expect(processedEntry?.detail.agentId).toBe("default-agent");
  });
});
