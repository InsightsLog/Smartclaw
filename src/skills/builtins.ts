/**
 * Smartclaw — Built-in reference skills.
 *
 * A set of foundational skills that ship with Smartclaw.
 * Following Nanoclaw's philosophy: "Don't add features. Add skills."
 */

import type { SkillDefinition } from "../types.js";
import type { SkillFactory } from "./loader.js";

/**
 * Echo skill — returns the user's query back.
 * Useful for testing the pipeline end-to-end.
 */
export function createEchoSkill(): SkillDefinition {
  return {
    name: "echo",
    domain: "general",
    description: "Echoes the user input back",
    version: "1.0.0",
    execute: async (input) => ({
      result: input.query,
      metadata: { skill: "echo" },
    }),
  };
}

/**
 * Calculator skill — evaluates basic arithmetic expressions.
 * Supports +, -, *, /, parentheses, and decimal numbers.
 */
export function createCalculatorSkill(): SkillDefinition {
  return {
    name: "calculator",
    domain: "math",
    description: "Evaluates basic arithmetic expressions",
    version: "1.0.0",
    execute: async (input) => {
      const result = safeEvaluate(input.query);
      return {
        result: result !== null ? String(result) : "Unable to evaluate expression",
        metadata: { skill: "calculator", expression: input.query, success: result !== null },
      };
    },
  };
}

/**
 * Help skill — lists available skills and their descriptions.
 */
export function createHelpSkill(getSkillList: () => Array<{ name: string; description: string }>): SkillDefinition {
  return {
    name: "help",
    domain: "general",
    description: "Lists available skills and their descriptions",
    version: "1.0.0",
    execute: async () => {
      const skills = getSkillList();
      if (skills.length === 0) {
        return { result: "No skills are currently registered.", metadata: { skill: "help" } };
      }
      const lines = skills.map((s) => `• ${s.name}: ${s.description}`);
      return {
        result: `Available skills:\n${lines.join("\n")}`,
        metadata: { skill: "help", count: skills.length },
      };
    },
  };
}

/**
 * Summarize skill — produces a brief summary of the input text.
 * Simple extractive approach: returns the first two sentences or first 200 chars.
 */
export function createSummarizeSkill(): SkillDefinition {
  return {
    name: "summarize",
    domain: "writing",
    description: "Produces a brief summary of the provided text",
    version: "1.0.0",
    execute: async (input) => {
      const text = input.query.trim();
      const sentences = text.split(/(?<=[.!?])\s+/);
      const summary = sentences.length > 2
        ? sentences.slice(0, 2).join(" ")
        : text.length > 200
          ? text.slice(0, 200) + "…"
          : text;
      return {
        result: summary,
        metadata: { skill: "summarize", originalLength: text.length, summaryLength: summary.length },
      };
    },
  };
}

/**
 * Get all built-in skill factories for use with SkillLoader.
 */
export function getBuiltinFactories(
  getSkillList: () => Array<{ name: string; description: string }>,
): SkillFactory[] {
  return [
    { name: "echo", domain: "general", create: () => createEchoSkill() },
    { name: "calculator", domain: "math", create: () => createCalculatorSkill() },
    { name: "help", domain: "general", create: () => createHelpSkill(getSkillList) },
    { name: "summarize", domain: "writing", create: () => createSummarizeSkill() },
  ];
}

/**
 * Safe arithmetic evaluator — no eval().
 * Supports: +, -, *, /, parentheses, decimal numbers, negative numbers.
 */
function safeEvaluate(expr: string): number | null {
  // Strip whitespace and validate characters
  const cleaned = expr.replace(/\s+/g, "");
  if (!/^[\d+\-*/().]+$/.test(cleaned)) return null;
  if (cleaned.length === 0) return null;

  try {
    return parseExpression(cleaned, { pos: 0 });
  } catch {
    return null;
  }
}

interface ParseState {
  pos: number;
}

function parseExpression(expr: string, state: ParseState): number {
  let result = parseTerm(expr, state);
  while (state.pos < expr.length && (expr[state.pos] === "+" || expr[state.pos] === "-")) {
    const op = expr[state.pos++];
    const term = parseTerm(expr, state);
    result = op === "+" ? result + term : result - term;
  }
  return result;
}

function parseTerm(expr: string, state: ParseState): number {
  let result = parseFactor(expr, state);
  while (state.pos < expr.length && (expr[state.pos] === "*" || expr[state.pos] === "/")) {
    const op = expr[state.pos++];
    const factor = parseFactor(expr, state);
    if (op === "/" && factor === 0) throw new Error("Division by zero");
    result = op === "*" ? result * factor : result / factor;
  }
  return result;
}

function parseFactor(expr: string, state: ParseState): number {
  // Handle unary minus
  if (expr[state.pos] === "-") {
    state.pos++;
    return -parseFactor(expr, state);
  }

  // Handle parentheses
  if (expr[state.pos] === "(") {
    state.pos++; // skip '('
    const result = parseExpression(expr, state);
    if (expr[state.pos] === ")") state.pos++; // skip ')'
    return result;
  }

  // Parse number
  const start = state.pos;
  while (state.pos < expr.length && (/\d/.test(expr[state.pos]) || expr[state.pos] === ".")) {
    state.pos++;
  }
  if (state.pos === start) throw new Error("Expected number");
  return parseFloat(expr.slice(start, state.pos));
}
