/**
 * Smartclaw — Dynamic prompt engine (from ClawdMatrix).
 *
 * Five-stage cognitive pipeline:
 *  1. Intent Triage Protocol — detect domain & decide if skills are needed
 *  2. Dynamic Skill Injection — load only relevant skills into prompt
 *  3. Prompt Assembly — compose the final prompt
 *  4. Quality Gates — validate output meets standards
 *  5. Token Optimization — stay within budget
 */

import { IntentTriangulator } from "./triangulator.js";
import type { IntentAnalysis, QualityGateResult, SkillDefinition } from "../types.js";

/** The full result of processing a message through the pipeline. */
export interface PipelineResult {
  intent: IntentAnalysis;
  injectedSkills: string[];
  prompt: string;
  qualityGates: QualityGateResult[];
  tokenEstimate: number;
}

/**
 * Five-stage cognitive prompt pipeline.
 */
export class PromptEngine {
  private triangulator: IntentTriangulator;
  private tokenBudget: number;
  private qualityGateEnabled: boolean;

  /** Skills available for injection, keyed by domain. */
  private skillsByDomain = new Map<string, SkillDefinition[]>();

  constructor(options: { tokenBudget?: number; qualityGateEnabled?: boolean } = {}) {
    this.triangulator = new IntentTriangulator();
    this.tokenBudget = options.tokenBudget ?? 4096;
    this.qualityGateEnabled = options.qualityGateEnabled ?? true;
  }

  /** Register a skill so the engine can inject it when its domain is detected. */
  registerSkill(skill: SkillDefinition): void {
    const list = this.skillsByDomain.get(skill.domain) ?? [];
    list.push(skill);
    this.skillsByDomain.set(skill.domain, list);
  }

  /**
   * Process a user message through the full five-stage pipeline.
   */
  processMessage(content: string, systemPrompt = "You are Smartclaw, a helpful AI assistant."): PipelineResult {
    // Stage 1: Intent triage
    const intent = this.triageIntent(content);

    // Stage 2: Dynamic skill injection
    const injectedSkills = this.injectSkills(intent);

    // Stage 3: Prompt assembly
    const prompt = this.assemblePrompt(systemPrompt, content, intent, injectedSkills);

    // Stage 4: Quality gates
    const qualityGates = this.applyQualityGates(prompt, intent);

    // Stage 5: Token estimation
    const tokenEstimate = this.estimateTokens(prompt);

    return { intent, injectedSkills, prompt, qualityGates, tokenEstimate };
  }

  /** Stage 1: Triage intent using the triangulator. */
  triageIntent(content: string): IntentAnalysis {
    return this.triangulator.analyze(content);
  }

  /** Stage 2: Inject skill descriptions based on detected domain. */
  injectSkills(intent: IntentAnalysis): string[] {
    if (!intent.requiresSkills) return [];
    const skills = this.skillsByDomain.get(intent.domain) ?? [];
    return skills.map((s) => s.name);
  }

  /** Stage 4: Run quality gates on the assembled prompt. */
  applyQualityGates(prompt: string, intent: IntentAnalysis): QualityGateResult[] {
    if (!this.qualityGateEnabled) return [];

    const gates: QualityGateResult[] = [];

    // Gate 1: Token budget
    const tokenEstimate = this.estimateTokens(prompt);
    gates.push({
      passed: tokenEstimate <= this.tokenBudget,
      stage: "token-budget",
      reason:
        tokenEstimate <= this.tokenBudget
          ? `Within budget (${tokenEstimate}/${this.tokenBudget})`
          : `Over budget (${tokenEstimate}/${this.tokenBudget})`,
    });

    // Gate 2: Prompt non-empty
    gates.push({
      passed: prompt.length > 0,
      stage: "non-empty",
      reason: prompt.length > 0 ? "Prompt is non-empty" : "Prompt is empty",
    });

    // Gate 3: Confidence threshold
    gates.push({
      passed: intent.confidence >= 0.3,
      stage: "confidence",
      reason:
        intent.confidence >= 0.3
          ? `Confidence ${intent.confidence} meets threshold`
          : `Low confidence ${intent.confidence}`,
    });

    return gates;
  }

  /** Assemble the final prompt from components. */
  private assemblePrompt(
    systemPrompt: string,
    userMessage: string,
    intent: IntentAnalysis,
    skillNames: string[],
  ): string {
    const parts: string[] = [systemPrompt];

    if (skillNames.length > 0) {
      parts.push(`\nAvailable skills: ${skillNames.join(", ")}`);
    }

    parts.push(`\nDomain: ${intent.domain} | Complexity: ${intent.complexity}`);
    parts.push(`\nUser: ${userMessage}`);

    return parts.join("\n");
  }

  /** Rough token estimation (~4 chars per token). */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}
