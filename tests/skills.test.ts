import { describe, it, expect, beforeEach } from "vitest";
import { SkillsRegistry } from "../src/skills/registry.js";
import { SkillLoader } from "../src/skills/loader.js";
import type { SkillDefinition, IntentAnalysis } from "../src/types.js";

function dummySkill(name: string, domain: string): SkillDefinition {
  return {
    name,
    domain,
    description: `${name} skill`,
    execute: async (input) => ({ result: `${name}: ${input.query}` }),
  };
}

describe("SkillsRegistry", () => {
  let registry: SkillsRegistry;

  beforeEach(() => {
    registry = new SkillsRegistry();
  });

  it("registers and retrieves skills", () => {
    registry.register(dummySkill("search", "research"));
    expect(registry.has("search")).toBe(true);
    expect(registry.get("search")?.domain).toBe("research");
  });

  it("throws on duplicate registration", () => {
    registry.register(dummySkill("search", "research"));
    expect(() => registry.register(dummySkill("search", "research"))).toThrow("already registered");
  });

  it("unregisters skills", () => {
    registry.register(dummySkill("search", "research"));
    expect(registry.unregister("search")).toBe(true);
    expect(registry.has("search")).toBe(false);
  });

  it("lists all skill names", () => {
    registry.register(dummySkill("a", "x"));
    registry.register(dummySkill("b", "y"));
    expect(registry.list()).toEqual(["a", "b"]);
  });

  it("finds skills by domain", () => {
    registry.register(dummySkill("a", "code"));
    registry.register(dummySkill("b", "code"));
    registry.register(dummySkill("c", "research"));
    expect(registry.findByDomain("code")).toHaveLength(2);
  });

  it("executes a skill", async () => {
    registry.register(dummySkill("echo", "general"));
    const result = await registry.execute("echo", { query: "test" });
    expect(result.result).toBe("echo: test");
  });

  it("throws when executing unknown skill", async () => {
    await expect(registry.execute("nope", { query: "" })).rejects.toThrow("not found");
  });

  it("reports size", () => {
    expect(registry.size).toBe(0);
    registry.register(dummySkill("a", "x"));
    expect(registry.size).toBe(1);
  });
});

describe("SkillLoader", () => {
  let loader: SkillLoader;
  let registry: SkillsRegistry;

  const codeIntent: IntentAnalysis = {
    domain: "code",
    complexity: "moderate",
    requiresSkills: true,
    confidence: 0.8,
    userLevel: "intermediate",
    tone: "technical",
  };

  beforeEach(() => {
    loader = new SkillLoader();
    registry = new SkillsRegistry();
  });

  it("registers and lists factories", () => {
    loader.registerFactory({ name: "lint", domain: "code", create: () => dummySkill("lint", "code") });
    expect(loader.listFactories()).toEqual(["lint"]);
    expect(loader.size).toBe(1);
  });

  it("loads skills for matching domain", () => {
    loader.registerFactory({ name: "lint", domain: "code", create: () => dummySkill("lint", "code") });
    loader.registerFactory({ name: "search", domain: "research", create: () => dummySkill("search", "research") });

    const loaded = loader.loadForIntent(codeIntent, registry);
    expect(loaded).toEqual(["lint"]);
    expect(registry.has("lint")).toBe(true);
    expect(registry.has("search")).toBe(false);
  });

  it("does not double-load skills", () => {
    loader.registerFactory({ name: "lint", domain: "code", create: () => dummySkill("lint", "code") });
    loader.loadForIntent(codeIntent, registry);
    const secondLoad = loader.loadForIntent(codeIntent, registry);
    expect(secondLoad).toEqual([]);
  });

  it("removes factories", () => {
    loader.registerFactory({ name: "lint", domain: "code", create: () => dummySkill("lint", "code") });
    expect(loader.removeFactory("lint")).toBe(true);
    expect(loader.size).toBe(0);
  });

  it("lists factories by domain", () => {
    loader.registerFactory({ name: "lint", domain: "code", create: () => dummySkill("lint", "code") });
    loader.registerFactory({ name: "fmt", domain: "code", create: () => dummySkill("fmt", "code") });
    loader.registerFactory({ name: "search", domain: "research", create: () => dummySkill("search", "research") });
    expect(loader.listByDomain("code")).toEqual(["lint", "fmt"]);
  });
});
