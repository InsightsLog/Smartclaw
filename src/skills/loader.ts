/**
 * Smartclaw — Skill loader (from ClawdMatrix + Nanoclaw).
 *
 * Dynamically loads skill definitions based on detected domain/intent.
 * Keeps memory lean by only instantiating skills that are needed.
 */

import type { IntentAnalysis, SkillDefinition } from "../types.js";
import { SkillsRegistry } from "./registry.js";

/** A factory that can produce a SkillDefinition on demand. */
export interface SkillFactory {
  name: string;
  domain: string;
  create: () => SkillDefinition;
}

/**
 * Lazy loader that creates skills on demand and feeds them
 * into a SkillsRegistry.
 */
export class SkillLoader {
  private factories = new Map<string, SkillFactory>();

  /** Register a skill factory (lazy — skill is not created yet). */
  registerFactory(factory: SkillFactory): void {
    this.factories.set(factory.name, factory);
  }

  /** Remove a factory by name. */
  removeFactory(name: string): boolean {
    return this.factories.delete(name);
  }

  /**
   * Load skills relevant to the given intent into the registry.
   * Returns the names of skills that were loaded.
   */
  loadForIntent(intent: IntentAnalysis, registry: SkillsRegistry): string[] {
    const loaded: string[] = [];

    for (const factory of this.factories.values()) {
      if (factory.domain === intent.domain && !registry.has(factory.name)) {
        const skill = factory.create();
        registry.register(skill);
        loaded.push(factory.name);
      }
    }

    return loaded;
  }

  /** List all registered factory names. */
  listFactories(): string[] {
    return [...this.factories.keys()];
  }

  /** List factory names that belong to a domain. */
  listByDomain(domain: string): string[] {
    return [...this.factories.values()]
      .filter((f) => f.domain === domain)
      .map((f) => f.name);
  }

  /** Number of registered factories. */
  get size(): number {
    return this.factories.size;
  }
}
