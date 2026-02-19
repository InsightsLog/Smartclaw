import { describe, it, expect, beforeEach } from "vitest";
import { PromptEngine } from "../src/prompt/engine.js";
import { IntentTriangulator } from "../src/prompt/triangulator.js";
import type { SkillDefinition } from "../src/types.js";

function dummySkill(name: string, domain: string): SkillDefinition {
  return {
    name,
    domain,
    description: `${name} skill`,
    execute: async (input) => ({ result: `${name}: ${input.query}` }),
  };
}

describe("IntentTriangulator", () => {
  let triangulator: IntentTriangulator;

  beforeEach(() => {
    triangulator = new IntentTriangulator();
  });

  it("detects code domain", () => {
    const result = triangulator.analyze("fix this bug in my function");
    expect(result.domain).toBe("code");
    expect(result.requiresSkills).toBe(true);
  });

  it("detects research domain", () => {
    const result = triangulator.analyze("what is quantum computing");
    expect(result.domain).toBe("research");
  });

  it("detects general domain for greetings", () => {
    const result = triangulator.analyze("hello");
    expect(result.domain).toBe("general");
    expect(result.requiresSkills).toBe(false);
  });

  it("assesses complexity from length", () => {
    expect(triangulator.analyze("hi").complexity).toBe("simple");
    expect(triangulator.analyze("please help me write a function that sorts an array").complexity).toBe("moderate");
    expect(
      triangulator.analyze(
        "I need you to refactor the entire authentication module to use JWT tokens " +
        "instead of session cookies and also add rate limiting and audit logging " +
        "and make sure all the tests pass and update the documentation accordingly",
      ).complexity,
    ).toBe("complex");
  });

  it("detects technical tone", () => {
    const result = triangulator.analyze("optimize the algorithm to reduce latency");
    expect(result.tone).toBe("technical");
  });

  it("detects formal tone", () => {
    const result = triangulator.analyze("could you please help me write a letter");
    expect(result.tone).toBe("formal");
  });

  it("assesses expert user level", () => {
    const result = triangulator.analyze("refactor and optimize the algorithm");
    expect(result.userLevel).toBe("expert");
  });

  it("returns confidence between 0 and 1", () => {
    const result = triangulator.analyze("debug this code error");
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });
});

describe("PromptEngine", () => {
  let engine: PromptEngine;

  beforeEach(() => {
    engine = new PromptEngine({ tokenBudget: 4096, qualityGateEnabled: true });
  });

  it("processes a message through the full pipeline", () => {
    const result = engine.processMessage("hello");
    expect(result.intent.domain).toBe("general");
    expect(result.prompt).toContain("hello");
    expect(result.tokenEstimate).toBeGreaterThan(0);
  });

  it("injects skills for matching domains", () => {
    engine.registerSkill(dummySkill("code-review", "code"));
    engine.registerSkill(dummySkill("search-web", "research"));

    const result = engine.processMessage("fix this bug in my function");
    expect(result.injectedSkills).toContain("code-review");
    expect(result.injectedSkills).not.toContain("search-web");
  });

  it("skips skill injection for simple general messages", () => {
    engine.registerSkill(dummySkill("code-review", "code"));
    const result = engine.processMessage("hi");
    expect(result.injectedSkills).toEqual([]);
  });

  it("runs quality gates", () => {
    const result = engine.processMessage("write some code");
    expect(result.qualityGates.length).toBeGreaterThan(0);
    const tokenGate = result.qualityGates.find((g) => g.stage === "token-budget");
    expect(tokenGate?.passed).toBe(true);
  });

  it("skips quality gates when disabled", () => {
    const noGates = new PromptEngine({ qualityGateEnabled: false });
    const result = noGates.processMessage("test");
    expect(result.qualityGates).toEqual([]);
  });

  it("includes skill names in assembled prompt", () => {
    engine.registerSkill(dummySkill("helper", "research"));
    const result = engine.processMessage("search for information about AI");
    expect(result.prompt).toContain("helper");
  });

  it("includes domain and complexity in prompt", () => {
    const result = engine.processMessage("debug this code error");
    expect(result.prompt).toContain("code");
    expect(result.prompt).toContain("Domain:");
  });
});
