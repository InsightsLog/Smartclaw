import { describe, it, expect, beforeEach } from "vitest";
import { Agent } from "../src/agents/agent.js";
import { AgentRegistry } from "../src/agents/registry.js";
import type { AgentConfig } from "../src/types.js";

function makeAgentConfig(overrides: Partial<AgentConfig> = {}): AgentConfig {
  return {
    id: "agent-1",
    name: "Test Agent",
    description: "A test agent",
    systemPrompt: "You are a test agent.",
    ...overrides,
  };
}

describe("Agent", () => {
  let agent: Agent;

  beforeEach(() => {
    agent = new Agent(makeAgentConfig());
  });

  // ── Identity ────────────────────────────────────────

  it("stores identity from config", () => {
    expect(agent.id).toBe("agent-1");
    expect(agent.name).toBe("Test Agent");
    expect(agent.description).toBe("A test agent");
    expect(agent.systemPrompt).toBe("You are a test agent.");
  });

  it("stores optional config fields", () => {
    const a = new Agent(
      makeAgentConfig({
        domains: ["code", "research"],
        allowedSkills: ["calculator"],
        personality: { style: "formal" },
      }),
    );
    expect(a.domains).toEqual(["code", "research"]);
    expect(a.allowedSkills).toEqual(["calculator"]);
    expect(a.personality).toEqual({ style: "formal" });
  });

  it("defaults optional fields to empty", () => {
    expect(agent.domains).toEqual([]);
    expect(agent.allowedSkills).toEqual([]);
    expect(agent.personality).toEqual({});
  });

  // ── Status & Lifecycle ──────────────────────────────

  it("starts in idle status", () => {
    expect(agent.status).toBe("idle");
  });

  it("can be activated", () => {
    agent.activate();
    expect(agent.status).toBe("active");
  });

  it("can be deactivated back to idle", () => {
    agent.activate();
    agent.deactivate();
    expect(agent.status).toBe("idle");
  });

  it("does not deactivate from offline", () => {
    agent.goOffline();
    agent.deactivate();
    expect(agent.status).toBe("offline");
  });

  it("can go offline and back online", () => {
    agent.goOffline();
    expect(agent.status).toBe("offline");
    agent.goOnline();
    expect(agent.status).toBe("idle");
  });

  it("can set arbitrary status", () => {
    agent.setStatus("busy");
    expect(agent.status).toBe("busy");
  });

  // ── Memory ──────────────────────────────────────────

  it("starts with empty memory", () => {
    expect(agent.memorySize).toBe(0);
    expect(agent.memory).toEqual([]);
  });

  it("records memory entries", () => {
    agent.remember("user", "hello");
    agent.remember("agent", "hi there");
    expect(agent.memorySize).toBe(2);
    expect(agent.memory[0].role).toBe("user");
    expect(agent.memory[0].content).toBe("hello");
    expect(agent.memory[1].role).toBe("agent");
  });

  it("returns memory entries with ids and timestamps", () => {
    const entry = agent.remember("system", "initialized");
    expect(entry.id).toMatch(/^mem_/);
    expect(entry.timestamp).toBeGreaterThan(0);
    expect(entry.role).toBe("system");
  });

  it("stores metadata with memory entries", () => {
    const entry = agent.remember("user", "test", { messageId: "msg-1" });
    expect(entry.metadata?.messageId).toBe("msg-1");
  });

  it("retrieves recent memory", () => {
    for (let i = 0; i < 10; i++) {
      agent.remember("user", `message ${i}`);
    }
    const recent = agent.recentMemory(3);
    expect(recent).toHaveLength(3);
    expect(recent[0].content).toBe("message 7");
    expect(recent[2].content).toBe("message 9");
  });

  it("evicts oldest entries when memory limit is reached", () => {
    const smallAgent = new Agent(makeAgentConfig(), 3);
    smallAgent.remember("user", "a");
    smallAgent.remember("user", "b");
    smallAgent.remember("user", "c");
    smallAgent.remember("user", "d");
    expect(smallAgent.memorySize).toBe(3);
    expect(smallAgent.memory[0].content).toBe("b");
  });

  it("clears memory", () => {
    agent.remember("user", "hello");
    agent.clearMemory();
    expect(agent.memorySize).toBe(0);
  });

  // ── Skill Access ────────────────────────────────────

  it("allows all skills when allowedSkills is empty", () => {
    expect(agent.canUseSkill("calculator")).toBe(true);
    expect(agent.canUseSkill("anything")).toBe(true);
  });

  it("restricts skills when allowedSkills is specified", () => {
    const restricted = new Agent(
      makeAgentConfig({ allowedSkills: ["calculator", "echo"] }),
    );
    expect(restricted.canUseSkill("calculator")).toBe(true);
    expect(restricted.canUseSkill("echo")).toBe(true);
    expect(restricted.canUseSkill("summarize")).toBe(false);
  });

  // ── Stats ───────────────────────────────────────────

  it("tracks creation time", () => {
    expect(agent.createdAt).toBeGreaterThan(0);
    expect(agent.createdAt).toBeLessThanOrEqual(Date.now());
  });

  it("tracks last active time", () => {
    const before = agent.lastActiveAt;
    agent.activate();
    expect(agent.lastActiveAt).toBeGreaterThanOrEqual(before);
  });

  it("counts messages handled", () => {
    expect(agent.messagesHandled).toBe(0);
    agent.recordInteraction();
    agent.recordInteraction();
    expect(agent.messagesHandled).toBe(2);
  });

  // ── Context Building ───────────────────────────────

  it("returns empty string when no memory", () => {
    expect(agent.buildContext()).toBe("");
  });

  it("builds context from recent memory", () => {
    agent.remember("user", "hello");
    agent.remember("agent", "hi there");
    const ctx = agent.buildContext();
    expect(ctx).toContain("[user] hello");
    expect(ctx).toContain("[agent] hi there");
  });

  it("limits context to specified count", () => {
    for (let i = 0; i < 20; i++) {
      agent.remember("user", `msg ${i}`);
    }
    const ctx = agent.buildContext(2);
    const lines = ctx.split("\n");
    expect(lines).toHaveLength(2);
  });
});

describe("AgentRegistry", () => {
  let registry: AgentRegistry;

  beforeEach(() => {
    registry = new AgentRegistry();
  });

  it("registers and retrieves agents", () => {
    const agent = registry.register(makeAgentConfig());
    expect(agent).toBeInstanceOf(Agent);
    expect(registry.has("agent-1")).toBe(true);
    expect(registry.get("agent-1")?.name).toBe("Test Agent");
  });

  it("throws on duplicate registration", () => {
    registry.register(makeAgentConfig());
    expect(() => registry.register(makeAgentConfig())).toThrow("already registered");
  });

  it("unregisters agents", () => {
    registry.register(makeAgentConfig());
    expect(registry.unregister("agent-1")).toBe(true);
    expect(registry.has("agent-1")).toBe(false);
    expect(registry.unregister("agent-1")).toBe(false);
  });

  it("lists all agent ids", () => {
    registry.register(makeAgentConfig({ id: "a" }));
    registry.register(makeAgentConfig({ id: "b" }));
    expect(registry.list()).toEqual(["a", "b"]);
  });

  it("returns all agents", () => {
    registry.register(makeAgentConfig({ id: "a" }));
    registry.register(makeAgentConfig({ id: "b" }));
    expect(registry.all()).toHaveLength(2);
  });

  it("finds agents by domain", () => {
    registry.register(makeAgentConfig({ id: "coder", domains: ["code"] }));
    registry.register(makeAgentConfig({ id: "researcher", domains: ["research"] }));
    registry.register(makeAgentConfig({ id: "general" })); // no domains = matches all

    const codeAgents = registry.findByDomain("code");
    expect(codeAgents.map((a) => a.id)).toContain("coder");
    expect(codeAgents.map((a) => a.id)).toContain("general");
    expect(codeAgents.map((a) => a.id)).not.toContain("researcher");
  });

  it("finds agents by status", () => {
    const a1 = registry.register(makeAgentConfig({ id: "a1" }));
    const a2 = registry.register(makeAgentConfig({ id: "a2" }));
    a1.activate();
    expect(registry.findByStatus("active").map((a) => a.id)).toEqual(["a1"]);
    expect(registry.findByStatus("idle").map((a) => a.id)).toEqual(["a2"]);
  });

  it("reports size", () => {
    expect(registry.size).toBe(0);
    registry.register(makeAgentConfig({ id: "a" }));
    expect(registry.size).toBe(1);
  });

  it("passes memory limit to agent", () => {
    const agent = registry.register(makeAgentConfig(), 5);
    for (let i = 0; i < 10; i++) {
      agent.remember("user", `msg ${i}`);
    }
    expect(agent.memorySize).toBe(5);
  });
});
