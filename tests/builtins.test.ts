import { describe, it, expect, beforeEach } from "vitest";
import {
  createEchoSkill,
  createCalculatorSkill,
  createHelpSkill,
  createSummarizeSkill,
  getBuiltinFactories,
} from "../src/skills/builtins.js";
import { SkillsRegistry } from "../src/skills/registry.js";
import { SkillLoader } from "../src/skills/loader.js";
import type { IntentAnalysis } from "../src/types.js";

describe("Built-in Skills", () => {
  describe("Echo Skill", () => {
    it("echoes the input query", async () => {
      const echo = createEchoSkill();
      const result = await echo.execute({ query: "hello world" });
      expect(result.result).toBe("hello world");
      expect(result.metadata?.skill).toBe("echo");
    });

    it("has correct metadata", () => {
      const echo = createEchoSkill();
      expect(echo.name).toBe("echo");
      expect(echo.domain).toBe("general");
      expect(echo.version).toBe("1.0.0");
    });
  });

  describe("Calculator Skill", () => {
    it("evaluates basic addition", async () => {
      const calc = createCalculatorSkill();
      const result = await calc.execute({ query: "2 + 3" });
      expect(result.result).toBe("5");
    });

    it("evaluates multiplication", async () => {
      const calc = createCalculatorSkill();
      const result = await calc.execute({ query: "4 * 7" });
      expect(result.result).toBe("28");
    });

    it("evaluates parenthesized expressions", async () => {
      const calc = createCalculatorSkill();
      const result = await calc.execute({ query: "(2 + 3) * 4" });
      expect(result.result).toBe("20");
    });

    it("evaluates division", async () => {
      const calc = createCalculatorSkill();
      const result = await calc.execute({ query: "10 / 4" });
      expect(result.result).toBe("2.5");
    });

    it("handles invalid expressions gracefully", async () => {
      const calc = createCalculatorSkill();
      const result = await calc.execute({ query: "not a number" });
      expect(result.result).toBe("Unable to evaluate expression");
      expect(result.metadata?.success).toBe(false);
    });

    it("evaluates negative numbers", async () => {
      const calc = createCalculatorSkill();
      const result = await calc.execute({ query: "-5 + 3" });
      expect(result.result).toBe("-2");
    });
  });

  describe("Help Skill", () => {
    it("lists registered skills", async () => {
      const help = createHelpSkill(() => [
        { name: "echo", description: "Echoes input" },
        { name: "calculator", description: "Does math" },
      ]);
      const result = await help.execute({ query: "" });
      expect(result.result).toContain("echo");
      expect(result.result).toContain("calculator");
      expect(result.metadata?.count).toBe(2);
    });

    it("handles empty skill list", async () => {
      const help = createHelpSkill(() => []);
      const result = await help.execute({ query: "" });
      expect(result.result).toContain("No skills");
    });
  });

  describe("Summarize Skill", () => {
    it("summarizes by extracting first two sentences", async () => {
      const summarize = createSummarizeSkill();
      const result = await summarize.execute({
        query: "First sentence. Second sentence. Third sentence. Fourth sentence.",
      });
      expect(result.result).toBe("First sentence. Second sentence.");
    });

    it("returns short text as-is", async () => {
      const summarize = createSummarizeSkill();
      const result = await summarize.execute({ query: "Short text." });
      expect(result.result).toBe("Short text.");
    });

    it("has correct metadata", () => {
      const summarize = createSummarizeSkill();
      expect(summarize.name).toBe("summarize");
      expect(summarize.domain).toBe("writing");
    });
  });

  describe("getBuiltinFactories", () => {
    it("returns all built-in factories", () => {
      const factories = getBuiltinFactories(() => []);
      expect(factories.length).toBe(4);
      expect(factories.map((f) => f.name)).toEqual(["echo", "calculator", "help", "summarize"]);
    });

    it("factories create valid skills", () => {
      const factories = getBuiltinFactories(() => []);
      for (const factory of factories) {
        const skill = factory.create();
        expect(skill.name).toBe(factory.name);
        expect(skill.domain).toBe(factory.domain);
        expect(typeof skill.execute).toBe("function");
      }
    });

    it("integrates with SkillLoader", () => {
      const loader = new SkillLoader();
      const registry = new SkillsRegistry();
      const factories = getBuiltinFactories(() => []);

      for (const factory of factories) {
        loader.registerFactory(factory);
      }

      const mathIntent: IntentAnalysis = {
        domain: "math",
        complexity: "moderate",
        requiresSkills: true,
        confidence: 0.8,
        userLevel: "beginner",
        tone: "casual",
      };

      const loaded = loader.loadForIntent(mathIntent, registry);
      expect(loaded).toContain("calculator");
      expect(registry.has("calculator")).toBe(true);
    });
  });
});
