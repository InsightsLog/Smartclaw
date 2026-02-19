/**
 * Smartclaw — Intent triangulator (from ClawdMatrix).
 *
 * Analyzes domain, user level, and tone of input to determine
 * whether expensive skill scanning is needed.
 * This is stage 1 of the five-stage cognitive pipeline.
 */

import type { IntentAnalysis } from "../types.js";

/** Domain keyword mappings for fast classification. */
const DOMAIN_KEYWORDS: Record<string, string[]> = {
  code: ["code", "function", "bug", "error", "compile", "debug", "class", "import", "api", "typescript", "python"],
  research: ["search", "find", "look up", "what is", "who is", "explain", "summarize", "article"],
  writing: ["write", "draft", "edit", "proofread", "essay", "email", "letter", "blog"],
  math: ["calculate", "compute", "solve", "equation", "formula", "math", "number"],
  general: ["hello", "hi", "hey", "thanks", "help", "how are you"],
};

/** Tone markers. */
const TONE_MARKERS = {
  formal: ["please", "kindly", "would you", "could you", "i would appreciate"],
  technical: ["implement", "refactor", "optimize", "benchmark", "algorithm", "latency"],
  casual: ["hey", "yo", "cool", "lol", "gonna", "wanna", "sup"],
};

/**
 * Analyzes a user message to determine intent, complexity,
 * domain, and whether skill scanning is worthwhile.
 */
export class IntentTriangulator {
  /**
   * Analyze a message and return an intent analysis.
   *
   * @param content - The user's message
   * @returns Intent analysis with domain, complexity, and metadata
   */
  analyze(content: string): IntentAnalysis {
    const lower = content.toLowerCase();
    const domain = this.detectDomain(lower);
    const tone = this.detectTone(lower);
    const complexity = this.assessComplexity(content);
    const userLevel = this.assessUserLevel(lower);
    const requiresSkills = complexity !== "simple" || domain !== "general";
    const confidence = this.computeConfidence(lower, domain);

    return {
      domain,
      complexity,
      requiresSkills,
      confidence,
      userLevel,
      tone,
    };
  }

  /** Detect the primary domain of the message. */
  private detectDomain(text: string): string {
    let best = "general";
    let bestScore = 0;

    for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
      const score = keywords.filter((kw) => text.includes(kw)).length;
      if (score > bestScore) {
        bestScore = score;
        best = domain;
      }
    }

    return best;
  }

  /** Detect the tone of the message. */
  private detectTone(text: string): "casual" | "formal" | "technical" {
    const scores = {
      casual: TONE_MARKERS.casual.filter((m) => text.includes(m)).length,
      formal: TONE_MARKERS.formal.filter((m) => text.includes(m)).length,
      technical: TONE_MARKERS.technical.filter((m) => text.includes(m)).length,
    };

    const max = Math.max(scores.casual, scores.formal, scores.technical);
    if (max === 0) return "casual";
    if (scores.technical === max) return "technical";
    if (scores.formal === max) return "formal";
    return "casual";
  }

  /** Assess message complexity based on length and structure. */
  private assessComplexity(text: string): "simple" | "moderate" | "complex" {
    const wordCount = text.split(/\s+/).length;
    if (wordCount <= 5) return "simple";
    if (wordCount <= 30) return "moderate";
    return "complex";
  }

  /** Infer user expertise level from vocabulary. */
  private assessUserLevel(text: string): "beginner" | "intermediate" | "expert" {
    const expertTerms = ["refactor", "optimize", "benchmark", "algorithm", "latency", "idempotent", "polymorphism"];
    const expertCount = expertTerms.filter((t) => text.includes(t)).length;
    if (expertCount >= 2) return "expert";
    if (expertCount === 1) return "intermediate";
    return "beginner";
  }

  /** Compute a rough confidence score (0–1). */
  private computeConfidence(text: string, domain: string): number {
    if (domain === "general") return 0.5;
    const keywords = DOMAIN_KEYWORDS[domain] ?? [];
    const hits = keywords.filter((kw) => text.includes(kw)).length;
    return Math.min(1, 0.4 + hits * 0.15);
  }
}
